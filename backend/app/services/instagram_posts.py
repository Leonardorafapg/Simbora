# backend/app/services/instagram_posts.py
"""
Agendamento e publicação de posts no Instagram.

Proteções contra os bugs que o GBRAND teve (ou ainda tem):
- Reivindicação atômica (pendente -> publicando): o laço e o "publicar agora"
  nunca publicam o mesmo post duas vezes.
- O id do container é gravado ANTES de publicar. Numa nova tentativa (falha de
  rede depois do media_publish, servidor reiniciado no meio), o status do
  container diz se o post já saiu (PUBLISHED) — no GBRAND isso duplicava o post.
- "Batimento" durante a espera do container: um carrossel longo de vídeos não é
  tomado como travado e republicado enquanto ainda está publicando.
- Nova tentativa com espera crescente (2, 5, 15 min) em vez de 3 tentativas
  seguidas no mesmo minuto.
- Qualquer exceção (inclusive antes de chamar a Meta) devolve o post a um
  estado conhecido; nada fica preso em "publicando".
- Editar/cancelar só vale pra post pendente ou com erro, de forma atômica;
  não dá pra "republicar" um publicado mexendo no status.
"""
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core import instagram_client as ig
from app.core.database import SessionLocal
from app.models.calendar_entry import CalendarEntry
from app.models.instagram import InstagramPost, utcnow
from app.services import instagram_accounts
from app.services.instagram_media import is_video

logger = logging.getLogger("instagram")

MAX_ATTEMPTS = 3
RETRY_BACKOFF_MINUTES = (2, 5, 15)
QUOTA_RETRY_MINUTES = 60
STALE_HEARTBEAT_MINUTES = 10
CONTAINER_POLL_SECONDS = 5
IMAGE_CONTAINER_TIMEOUT = 120
VIDEO_CONTAINER_TIMEOUT = 600
CAROUSEL_PARENT_TIMEOUT = 180

EDITABLE_STATUSES = ("pendente", "erro")
# Postagem da Produção que pode ir pro Instagram: só aprovada.
SCHEDULABLE_ENTRY_STATUSES = ("finalizados",)
# Brasil sem horário de verão desde 2019 — offset fixo.
BRT = timezone(timedelta(hours=-3))

CAPTION_MAX = 2200
HASHTAGS_MAX = 30
MENTIONS_MAX = 20


class PostConflict(Exception):
    """Post mudou de estado (publicando/publicado) — 409 pro usuário."""


class PostValidationError(Exception):
    """Dados inválidos — 400 com a mensagem pro usuário."""


# --- Validação ----------------------------------------------------------------

def to_utc_naive(value: datetime) -> datetime:
    """Horário sem fuso é tratado como horário de Brasília."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=BRT)
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def validate_caption(caption: str | None, media_type: str) -> str | None:
    caption = (caption or "").strip() or None
    if caption is None or media_type == "STORIES":
        return None if media_type == "STORIES" else caption
    if len(caption) > CAPTION_MAX:
        raise PostValidationError(f"Legenda com {len(caption)} caracteres — o Instagram aceita até {CAPTION_MAX}.")
    hashtags = sum(1 for word in caption.split() if word.startswith("#") and len(word) > 1)
    if hashtags > HASHTAGS_MAX:
        raise PostValidationError(f"Legenda com {hashtags} hashtags — o Instagram aceita até {HASHTAGS_MAX}.")
    mentions = sum(1 for word in caption.split() if word.startswith("@") and len(word) > 1)
    if mentions > MENTIONS_MAX:
        raise PostValidationError(f"Legenda com {mentions} menções — o Instagram aceita até {MENTIONS_MAX}.")
    return caption


def validate_schedule_time(scheduled_at: datetime) -> datetime:
    value = to_utc_naive(scheduled_at)
    if value < utcnow() - timedelta(minutes=1):
        raise PostValidationError("Esse horário já passou. Escolha um horário futuro ou use \"Publicar agora\".")
    return value


def validate_entry_link(db: Session, entry_id: int, client_id: int, *, ignore_post_id: int | None = None) -> CalendarEntry:
    entry = db.get(CalendarEntry, entry_id)
    if entry is None:
        raise PostValidationError("Postagem do calendário não encontrada.")
    if entry.client_id != client_id:
        raise PostValidationError("A postagem é de outro cliente.")
    if entry.status not in SCHEDULABLE_ENTRY_STATUSES:
        raise PostValidationError("Só dá pra agendar no Instagram uma postagem aprovada.")
    query = db.query(InstagramPost).filter(
        InstagramPost.calendar_entry_id == entry_id,
        InstagramPost.status.in_(("pendente", "publicando", "publicado", "erro")),
    )
    if ignore_post_id is not None:
        query = query.filter(InstagramPost.id != ignore_post_id)
    if query.first() is not None:
        raise PostValidationError(
            "Essa postagem já tem um agendamento no Instagram (se deu erro, use \"Tentar de novo\" ou remova o agendamento)."
        )
    return entry


# --- CRUD -------------------------------------------------------------------------

def list_posts(db: Session, client_id: int | None = None, statuses: list[str] | None = None) -> list[InstagramPost]:
    query = db.query(InstagramPost)
    if client_id is not None:
        query = query.filter(InstagramPost.client_id == client_id)
    if statuses:
        query = query.filter(InstagramPost.status.in_(statuses))
    return query.order_by(InstagramPost.scheduled_at.desc()).all()


def latest_by_entries(db: Session, entry_ids: list[int]) -> dict[int, InstagramPost]:
    """Agendamento mais recente de cada postagem (badge do quadro de Produção)."""
    if not entry_ids:
        return {}
    posts = (
        db.query(InstagramPost)
        .filter(InstagramPost.calendar_entry_id.in_(entry_ids))
        .order_by(InstagramPost.created_at.asc(), InstagramPost.id.asc())
        .all()
    )
    return {post.calendar_entry_id: post for post in posts}


def update_fields(db: Session, post_id: int, values: dict) -> InstagramPost:
    """Aplica `values` só se o post ainda for editável (UPDATE condicional, atômico
    contra o laço que pode estar reivindicando o mesmo post agora)."""
    values = {**values, "updated_at": utcnow()}
    changed = (
        db.query(InstagramPost)
        .filter(InstagramPost.id == post_id, InstagramPost.status.in_(EDITABLE_STATUSES))
        .update(values, synchronize_session=False)
    )
    db.commit()
    if changed != 1:
        raise PostConflict("Esse post já está sendo publicado ou já foi publicado — não dá mais pra alterar.")
    post = db.get(InstagramPost, post_id)
    db.refresh(post)
    return post


def reset_for_retry_values() -> dict:
    return {
        "status": "pendente",
        "attempts": 0,
        "next_attempt_at": None,
        "error_message": None,
        "heartbeat_at": None,
    }


def delete_post(db: Session, post_id: int) -> None:
    """Publicado pode sair do CRM (não apaga do Instagram); publicando, não."""
    deleted = (
        db.query(InstagramPost)
        .filter(InstagramPost.id == post_id, InstagramPost.status != "publicando")
        .delete(synchronize_session=False)
    )
    db.commit()
    if deleted != 1:
        raise PostConflict("Esse post está sendo publicado agora — aguarde terminar.")


def cancel_for_entry(db: Session, entry_id: int, *, detach_others: bool) -> None:
    """Postagem saiu de "aprovados" ou foi apagada: cancela o agendamento que
    ainda não saiu (senão o laço publicaria algo que a equipe tirou da fila).
    Não faz commit — quem chama commita junto com a própria mudança."""
    db.query(InstagramPost).filter(
        InstagramPost.calendar_entry_id == entry_id,
        InstagramPost.status.in_(EDITABLE_STATUSES),
    ).delete(synchronize_session=False)
    if detach_others:
        db.query(InstagramPost).filter(InstagramPost.calendar_entry_id == entry_id).update(
            {"calendar_entry_id": None}, synchronize_session=False
        )


# --- Publicação -------------------------------------------------------------------

def claim(db: Session, post_id: int) -> bool:
    now = utcnow()
    changed = (
        db.query(InstagramPost)
        .filter(InstagramPost.id == post_id, InstagramPost.status == "pendente")
        .update({"status": "publicando", "heartbeat_at": now, "updated_at": now}, synchronize_session=False)
    )
    db.commit()
    return changed == 1


def claim_if_editable(db: Session, post_id: int) -> bool:
    """Reivindica um post pendente OU com erro (usado quando se descobre que ele já saiu)."""
    now = utcnow()
    changed = (
        db.query(InstagramPost)
        .filter(InstagramPost.id == post_id, InstagramPost.status.in_(EDITABLE_STATUSES))
        .update({"status": "publicando", "heartbeat_at": now, "updated_at": now}, synchronize_session=False)
    )
    db.commit()
    return changed == 1


def claim_for_publish_now(db: Session, post_id: int) -> None:
    """Reivindica pra publicar já. Post com erro volta a zero tentativas."""
    post = db.get(InstagramPost, post_id)
    if post is None:
        raise PostValidationError("Post não encontrado.")
    if post.status == "publicado":
        raise PostConflict("Esse post já foi publicado.")
    if post.status == "publicando":
        raise PostConflict("Esse post já está sendo publicado.")
    if post.status == "erro":
        db.query(InstagramPost).filter(InstagramPost.id == post_id, InstagramPost.status == "erro").update(
            {**reset_for_retry_values(), "updated_at": utcnow()}, synchronize_session=False
        )
        db.commit()
    if not claim(db, post_id):
        raise PostConflict("Esse post mudou de estado enquanto você tentava publicar. Atualize a página.")


def _heartbeat(db: Session, post_id: int) -> None:
    db.query(InstagramPost).filter(InstagramPost.id == post_id).update(
        {"heartbeat_at": utcnow()}, synchronize_session=False
    )
    db.commit()


def _wait_container(db: Session, post_id: int, container_id: str, token: str, timeout: int) -> str:
    """Espera o container sair de IN_PROGRESS. Devolve FINISHED ou PUBLISHED."""
    deadline = time.monotonic() + timeout
    while True:
        status = ig.get_container_status(container_id=container_id, access_token=token)
        code = status.get("status_code")
        if code in ("FINISHED", "PUBLISHED"):
            return code
        if code in ("ERROR", "EXPIRED"):
            detail = status.get("status") or code
            raise ig.InstagramApiError(f"O Instagram recusou a mídia ({detail})")
        if time.monotonic() >= deadline:
            raise ig.InstagramApiError("O Instagram demorou demais pra processar a mídia.", transient=True)
        time.sleep(CONTAINER_POLL_SECONDS)
        _heartbeat(db, post_id)


def _create_containers(db: Session, post: InstagramPost, ig_user_id: str, token: str) -> str:
    urls = post.publish_urls or post.media_urls
    if post.media_type == "CAROUSEL":
        children: list[str] = []
        for url in urls:
            video = is_video(url)
            child = ig.create_container(
                ig_user_id=ig_user_id, access_token=token, media_type="CAROUSEL_ITEM",
                media_url=url, is_video=video, is_carousel_item=True,
            )
            _wait_container(db, post.id, child, token, VIDEO_CONTAINER_TIMEOUT if video else IMAGE_CONTAINER_TIMEOUT)
            children.append(child)
        return ig.create_container(
            ig_user_id=ig_user_id, access_token=token, media_type="CAROUSEL", caption=post.caption, children=children
        )
    url = urls[0]
    return ig.create_container(
        ig_user_id=ig_user_id, access_token=token, media_type=post.media_type,
        media_url=url, is_video=is_video(url), caption=post.caption,
    )


def _container_timeout(post: InstagramPost) -> int:
    if post.media_type == "CAROUSEL":
        return CAROUSEL_PARENT_TIMEOUT
    urls = post.publish_urls or post.media_urls
    return VIDEO_CONTAINER_TIMEOUT if any(is_video(u) for u in urls) else IMAGE_CONTAINER_TIMEOUT


def _find_published_media(ig_user_id: str, token: str, post: InstagramPost) -> tuple[str | None, str | None]:
    """Container já PUBLISHED mas sem o id do post (a resposta do media_publish
    se perdeu): procura entre os posts mais recentes pela legenda."""
    if post.media_type == "STORIES":
        return None, None  # stories não aparecem no /media
    try:
        recent = ig.list_media(ig_user_id=ig_user_id, access_token=token, max_items=15)
    except ig.InstagramApiError:
        return None, None
    since = (post.heartbeat_at or post.scheduled_at) - timedelta(hours=2)
    caption = (post.caption or "").strip()
    for item in recent:
        posted = ig.parse_timestamp(item.get("timestamp"))
        if posted is None or posted.astimezone(timezone.utc).replace(tzinfo=None) < since:
            continue
        if (item.get("caption") or "").strip() == caption:
            return item.get("id"), item.get("permalink")
    return None, None


def _mark_published(db: Session, post: InstagramPost, media_id: str | None, permalink: str | None, token: str) -> None:
    if media_id and not permalink:
        try:
            permalink = ig.get_media(media_id=media_id, access_token=token).get("permalink")
        except ig.InstagramApiError:
            permalink = None
    post.status = "publicado"
    post.ig_media_id = media_id
    post.permalink = permalink
    post.published_at = utcnow()
    post.next_attempt_at = None
    post.heartbeat_at = None
    post.error_message = None if media_id else (
        "Publicado (confirmado pelo Instagram), mas não deu pra identificar o link do post."
    )
    _advance_calendar_entry(db, post)
    db.commit()


def _advance_calendar_entry(db: Session, post: InstagramPost) -> None:
    """Postagem aprovada que foi ao ar vai pra coluna "Publicados" (quando o quadro tiver essa coluna)."""
    if not post.calendar_entry_id:
        return
    from app.schemas.calendar_entry import CALENDAR_STATUSES  # import tardio: evita ciclo

    if "publicados" not in CALENDAR_STATUSES:
        return
    entry = db.get(CalendarEntry, post.calendar_entry_id)
    if entry is not None and entry.status == "finalizados":
        entry.status = "publicados"


def _register_failure(db: Session, post: InstagramPost, exc: Exception) -> None:
    db.rollback()
    post = db.get(InstagramPost, post.id)
    if post is None:
        return
    post.heartbeat_at = None

    if isinstance(exc, instagram_accounts.AccountUnavailable):
        post.status = "erro"
        post.error_message = f"{exc} Depois clique em \"Tentar de novo\"."
        db.commit()
        return

    if isinstance(exc, ig.InstagramApiError) and exc.is_auth_error:
        account = instagram_accounts.get_by_client(db, post.client_id)
        if account is not None and account.status == "ativo":
            account.status = "expirado"
            account.last_error = exc.message
        post.status = "erro"
        post.error_message = "A conexão com o Instagram expirou ou foi revogada — reconecte a conta e clique em \"Tentar de novo\"."
        db.commit()
        return

    message = exc.message if isinstance(exc, ig.InstagramApiError) else f"Erro inesperado: {type(exc).__name__}"
    post.attempts += 1
    if post.attempts >= MAX_ATTEMPTS:
        post.status = "erro"
        post.next_attempt_at = None
        post.error_message = message
    else:
        wait = RETRY_BACKOFF_MINUTES[min(post.attempts - 1, len(RETRY_BACKOFF_MINUTES) - 1)]
        post.status = "pendente"
        post.next_attempt_at = utcnow() + timedelta(minutes=wait)
        post.error_message = f"{message} — nova tentativa automática em {wait} min."
    db.commit()


def _publish(db: Session, post: InstagramPost) -> None:
    account, token = instagram_accounts.get_active_token(db, post.client_id)
    ig_user_id = account.ig_user_id

    # Container de outra conta (cliente reconectou outro @) não serve.
    if post.container_id and post.container_ig_user_id != ig_user_id:
        post.container_id = None
        post.container_ig_user_id = None
        db.commit()

    if post.container_id:
        state = ig.get_container_status(container_id=post.container_id, access_token=token).get("status_code")
        if state == "PUBLISHED":
            _mark_published(db, post, *_find_published_media(ig_user_id, token, post), token)
            return
        if state in ("ERROR", "EXPIRED", None):
            post.container_id = None
            post.container_ig_user_id = None
            db.commit()

    if not post.container_id:
        try:
            quota = ig.get_publishing_limit(ig_user_id=ig_user_id, access_token=token)
        except ig.InstagramApiError as exc:
            if exc.is_auth_error:
                raise
            quota = None  # consulta de cota é só cortesia; segue e deixa a Meta decidir
        if quota and quota[0] >= quota[1]:
            post.status = "pendente"
            post.heartbeat_at = None
            post.next_attempt_at = utcnow() + timedelta(minutes=QUOTA_RETRY_MINUTES)
            post.error_message = (
                f"Limite de {quota[1]} publicações em 24h atingido nessa conta — "
                f"nova tentativa automática em {QUOTA_RETRY_MINUTES} min."
            )
            db.commit()
            return
        container_id = _create_containers(db, post, ig_user_id, token)
        post.container_id = container_id
        post.container_ig_user_id = ig_user_id
        db.commit()  # gravado ANTES de publicar — é o que impede post duplicado

    state = _wait_container(db, post.id, post.container_id, token, _container_timeout(post))
    if state == "PUBLISHED":
        _mark_published(db, post, *_find_published_media(ig_user_id, token, post), token)
        return

    try:
        media_id = ig.publish_container(ig_user_id=ig_user_id, container_id=post.container_id, access_token=token)
    except ig.InstagramApiError:
        # A resposta pode ter se perdido depois de publicar de fato.
        try:
            after = ig.get_container_status(container_id=post.container_id, access_token=token).get("status_code")
        except ig.InstagramApiError:
            after = None
        if after == "PUBLISHED":
            _mark_published(db, post, *_find_published_media(ig_user_id, token, post), token)
            return
        raise
    _mark_published(db, post, media_id, None, token)


def publish_claimed(post_id: int) -> None:
    """Publica um post já reivindicado (status "publicando"). Nunca levanta."""
    db = SessionLocal()
    try:
        post = db.get(InstagramPost, post_id)
        if post is None or post.status != "publicando":
            return
        try:
            _publish(db, post)
            logger.info("[instagram] post %s -> %s", post_id, post.status)
        except Exception as exc:
            if not isinstance(exc, (ig.InstagramApiError, instagram_accounts.AccountUnavailable)):
                logger.exception("[instagram] falha inesperada publicando post %s", post_id)
            else:
                logger.warning("[instagram] falha publicando post %s: %s", post_id, exc)
            _register_failure(db, post, exc)
    except Exception:
        logger.exception("[instagram] falha ao registrar o resultado do post %s", post_id)
    finally:
        db.close()


def recover_stale(db: Session) -> int:
    """Post em "publicando" sem batimento há 10+ min: o processo morreu no meio
    (deploy/reinício). Volta pra fila — e a próxima tentativa consulta o
    container antes de publicar, então não duplica."""
    limit = utcnow() - timedelta(minutes=STALE_HEARTBEAT_MINUTES)
    stuck = (
        db.query(InstagramPost)
        .filter(
            InstagramPost.status == "publicando",
            or_(InstagramPost.heartbeat_at.is_(None), InstagramPost.heartbeat_at < limit),
        )
        .all()
    )
    for post in stuck:
        post.attempts += 1
        post.heartbeat_at = None
        if post.attempts >= MAX_ATTEMPTS:
            post.status = "erro"
            post.error_message = "Publicação interrompida várias vezes (servidor reiniciado?). Confira no Instagram antes de tentar de novo."
        else:
            post.status = "pendente"
            post.next_attempt_at = utcnow()
            post.error_message = "Publicação interrompida (servidor reiniciado?) — nova tentativa automática."
        logger.warning("[instagram] post %s preso em publicando -> %s", post.id, post.status)
    if stuck:
        db.commit()
    return len(stuck)


def due_post_ids(db: Session, limit: int = 20) -> list[int]:
    now = utcnow()
    rows = (
        db.query(InstagramPost.id)
        .filter(
            InstagramPost.status == "pendente",
            InstagramPost.scheduled_at <= now,
            or_(InstagramPost.next_attempt_at.is_(None), InstagramPost.next_attempt_at <= now),
        )
        .order_by(InstagramPost.scheduled_at.asc())
        .limit(limit)
        .all()
    )
    return [row[0] for row in rows]


# --- Laço em segundo plano -----------------------------------------------------------

LOOP_SECONDS = 30
TOKEN_RENEWAL_SECONDS = 6 * 60 * 60
PUBLISH_WORKERS = 3


class InstagramWorker:
    """Thread única do processo: a cada 30s destrava posts presos e publica os
    vencidos (até 3 em paralelo — um Reels demorando não segura a fila); a cada
    6h renova tokens perto de expirar."""

    def __init__(self) -> None:
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._pool = ThreadPoolExecutor(max_workers=PUBLISH_WORKERS, thread_name_prefix="ig-publish")
        self._last_renewal = 0.0

    def start(self) -> None:
        if self._thread is not None:
            return
        self._thread = threading.Thread(target=self._run, name="instagram-worker", daemon=True)
        self._thread.start()
        logger.info("[instagram] laço de publicação iniciado")

    def stop(self) -> None:
        self._stop.set()
        self._pool.shutdown(wait=False, cancel_futures=True)

    def submit(self, post_id: int) -> None:
        """Publica em segundo plano um post JÁ reivindicado."""
        self._pool.submit(publish_claimed, post_id)

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                self._tick()
            except Exception:
                logger.exception("[instagram] rodada do laço falhou")
            self._stop.wait(LOOP_SECONDS)

    def _tick(self) -> None:
        db = SessionLocal()
        try:
            recover_stale(db)
            for post_id in due_post_ids(db):
                if claim(db, post_id):
                    self.submit(post_id)
            if time.monotonic() - self._last_renewal >= TOKEN_RENEWAL_SECONDS or self._last_renewal == 0.0:
                self._last_renewal = time.monotonic()
                instagram_accounts.renew_expiring_tokens(db)
        finally:
            db.close()


worker = InstagramWorker()


def publish_now_in_background(post_id: int) -> None:
    """Usado pela rota "publicar agora" — funciona mesmo com o laço desligado."""
    worker.submit(post_id)


def as_utc(value: datetime | None) -> datetime | None:
    """UTC sem fuso (banco) -> com fuso explícito na resposta da API, senão o
    navegador leria o horário como local e mostraria 3h errado."""
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc)
