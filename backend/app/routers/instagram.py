# backend/app/routers/instagram.py
"""
Instagram: conexão OAuth por cliente, agendamento/publicação e métricas.

As rotas que falam com a Meta são `def` (não `async def`): o FastAPI roda no
threadpool e uma chamada lenta à Meta não trava o servidor inteiro.
"""
import base64
import hashlib
import hmac
import html
import json
import logging
from datetime import date, datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, Form, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import instagram_client as ig
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import require_permission
from app.models.client import Client
from app.models.instagram import InstagramAccount, InstagramPost, utcnow
from app.models.user import User
from app.schemas.instagram import (
    ConnectUrlOut,
    InsightsOut,
    InstagramAccountOut,
    InstagramIntegrationStatus,
    InstagramPostCreate,
    InstagramPostOut,
    InstagramPostUpdate,
    InstagramProfileOut,
    PostsInsightsOut,
)
from app.services import instagram_accounts, instagram_insights
from app.services import instagram_posts as posts_service
from app.services.instagram_media import MediaError, prepare_publish_urls, validate_media

logger = logging.getLogger("instagram")

router = APIRouter(prefix="/instagram", tags=["instagram"])

STATE_PURPOSE = "instagram_oauth_state"
STATE_MINUTES = 15

view_permission = require_permission("instagram.view")
manage_permission = require_permission("instagram.manage")


def _bad_request(message: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)


def _meta_error(db: Session, client_id: int, exc: ig.InstagramApiError) -> HTTPException:
    instagram_accounts.note_api_error(db, client_id, exc)
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=exc.message)


# --- Status da integração e conta ------------------------------------------------

@router.get("/status", response_model=InstagramIntegrationStatus)
def integration_status(_: User = Depends(view_permission)):
    return InstagramIntegrationStatus(configured=instagram_accounts.is_configured())


@router.get("/accounts/{client_id}", response_model=InstagramAccountOut)
def get_account(client_id: int, db: Session = Depends(get_db), _: User = Depends(view_permission)):
    account = instagram_accounts.get_by_client(db, client_id)
    if account is None:
        return InstagramAccountOut(client_id=client_id, status="nao_conectado")
    if account.status == "ativo" and account.token_expires_at and account.token_expires_at <= utcnow():
        instagram_accounts.mark_expired(db, account, "Token passou da validade sem ser renovado.")
    return InstagramAccountOut(
        client_id=client_id,
        status=account.status,
        username=account.username,
        profile_picture_url=account.profile_picture_url,
        token_expires_at=account.token_expires_at,
        connected_at=account.connected_at,
        last_error=account.last_error,
    )


@router.delete("/accounts/{client_id}", status_code=204)
def disconnect_account(client_id: int, db: Session = Depends(get_db), _: User = Depends(manage_permission)):
    account = instagram_accounts.get_by_client(db, client_id)
    if account is None or account.status == "desconectado":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Esse cliente não tem Instagram conectado")
    instagram_accounts.disconnect(db, account)


@router.get("/accounts/{client_id}/profile", response_model=InstagramProfileOut)
def get_profile(client_id: int, db: Session = Depends(get_db), _: User = Depends(view_permission)):
    try:
        return instagram_insights.get_profile(db, client_id)
    except instagram_accounts.AccountUnavailable as exc:
        raise _bad_request(str(exc))
    except ig.InstagramApiError as exc:
        raise _meta_error(db, client_id, exc)


# --- OAuth ----------------------------------------------------------------------

@router.get("/oauth/connect-url", response_model=ConnectUrlOut)
def connect_url(
    client_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(manage_permission),
):
    """URL de autorização da Meta. Quem loga e autoriza é o dono do Instagram
    do cliente — por isso o callback não tem JWT do CRM e o vínculo com o
    cliente vai no `state` assinado (não dá pra forjar um callback)."""
    if not instagram_accounts.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Integração com o Instagram não configurada no servidor (app da Meta).",
        )
    if db.get(Client, client_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")
    now = datetime.now(timezone.utc)
    state = jwt.encode(
        {
            "purpose": STATE_PURPOSE,
            "client_id": client_id,
            "uid": current_user.id,
            "iat": now,
            "exp": now + timedelta(minutes=STATE_MINUTES),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    url = ig.build_authorize_url(
        app_id=settings.INSTAGRAM_APP_ID, redirect_uri=instagram_accounts.redirect_uri(), state=state
    )
    return ConnectUrlOut(url=url)


def _page(message: str, ok: bool) -> HTMLResponse:
    """Página simples que a aba do OAuth mostra. Tudo escapado: a `error` da
    query vem de fora (no GBRAND ia cru pro HTML — XSS refletido)."""
    color = "#16a34a" if ok else "#dc2626"
    safe = html.escape(message)
    back = html.escape(settings.FRONTEND_ORIGIN, quote=True)
    body = f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Instagram — Simbora</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0a0a0a;color:#f5f5f5">
<div style="text-align:center;max-width:480px;padding:24px">
<p style="color:{color};font-size:18px;font-weight:600">{safe}</p>
<p style="font-size:14px;opacity:.7">Pode fechar esta aba e voltar ao <a href="{back}" style="color:#22d3ee">CRM</a>.</p>
</div>
</body></html>"""
    return HTMLResponse(body, headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"})


@router.get("/oauth/callback", response_class=HTMLResponse)
def oauth_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    db: Session = Depends(get_db),
):
    if error or not code or not state:
        reason = error_description or error or "código ausente"
        return _page(f"Autorização cancelada ou recusada: {reason}.", ok=False)

    try:
        payload = jwt.decode(state, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("purpose") != STATE_PURPOSE:
            raise ValueError("purpose inválido")
        client_id = int(payload["client_id"])
        user_id = int(payload["uid"]) if payload.get("uid") is not None else None
    except Exception:
        return _page("Link de autorização inválido ou expirado. Volte ao CRM e clique em conectar de novo.", ok=False)

    if db.get(Client, client_id) is None:
        return _page("Cliente não encontrado no CRM.", ok=False)

    try:
        short = ig.exchange_code(
            app_id=settings.INSTAGRAM_APP_ID,
            app_secret=settings.INSTAGRAM_APP_SECRET,
            redirect_uri=instagram_accounts.redirect_uri(),
            code=code.removesuffix("#_"),
        )
        long_lived = ig.exchange_long_lived(app_secret=settings.INSTAGRAM_APP_SECRET, short_token=short["access_token"])
        token = long_lived["access_token"]
        profile = ig.get_profile(access_token=token, fields="id,username,profile_picture_url")
    except (ig.InstagramApiError, KeyError) as exc:
        logger.warning("Falha ao conectar Instagram do cliente %s: %s", client_id, getattr(exc, "message", exc))
        return _page("Falha ao conectar com o Instagram. Tente de novo em alguns minutos.", ok=False)

    ig_user_id = str(profile.get("id") or short.get("user_id") or "")
    if not ig_user_id:
        return _page("O Instagram não informou qual conta foi conectada. Tente de novo.", ok=False)

    # A mesma conta do Instagram não pode ficar ligada a dois clientes.
    other = (
        db.query(InstagramAccount)
        .filter(
            InstagramAccount.ig_user_id == ig_user_id,
            InstagramAccount.client_id != client_id,
            InstagramAccount.status == "ativo",
        )
        .first()
    )
    if other is not None:
        other_client = db.get(Client, other.client_id)
        name = other_client.name if other_client else "outro cliente"
        return _page(f"Essa conta do Instagram já está conectada ao cliente {name}. Desconecte lá antes.", ok=False)

    account = instagram_accounts.save_connection(
        db,
        client_id=client_id,
        ig_user_id=ig_user_id,
        username=profile.get("username"),
        profile_picture_url=profile.get("profile_picture_url"),
        access_token=token,
        expires_in=long_lived.get("expires_in"),
        connected_by=user_id,
    )
    label = f" @{account.username}" if account.username else ""
    return _page(f"Instagram{label} conectado! Pode fechar esta aba.", ok=True)


def _parse_signed_request(signed_request: str) -> dict:
    """"<assinatura>.<payload>" em base64url; assinatura = HMAC-SHA256 do payload
    com o app secret. Sem conferir isso qualquer um forjaria uma desconexão."""
    if not settings.INSTAGRAM_APP_SECRET:
        raise ValueError("app secret não configurado")
    try:
        encoded_sig, encoded_payload = signed_request.split(".", 1)
    except ValueError:
        raise ValueError("signed_request malformado")

    def b64decode(value: str) -> bytes:
        return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))

    expected = hmac.new(settings.INSTAGRAM_APP_SECRET.encode(), encoded_payload.encode(), hashlib.sha256).digest()
    if not hmac.compare_digest(b64decode(encoded_sig), expected):
        raise ValueError("assinatura inválida")
    return json.loads(b64decode(encoded_payload))


@router.post("/oauth/deauthorize")
def oauth_deauthorize(signed_request: str = Form(...), db: Session = Depends(get_db)):
    """A Meta chama quando o dono da conta remove o app pelas configurações do Instagram."""
    try:
        payload = _parse_signed_request(signed_request)
    except (ValueError, json.JSONDecodeError):
        raise _bad_request("signed_request inválido")
    user_id = str(payload.get("user_id", ""))
    for account in db.query(InstagramAccount).filter(InstagramAccount.ig_user_id == user_id).all():
        instagram_accounts.disconnect(db, account, status="revogado")
    return {"success": True}


@router.post("/oauth/data-deletion")
def oauth_data_deletion(request: Request, signed_request: str = Form(...), db: Session = Depends(get_db)):
    """Pedido de exclusão de dados vindo da Meta. Resposta no formato exigido."""
    try:
        payload = _parse_signed_request(signed_request)
    except (ValueError, json.JSONDecodeError):
        raise _bad_request("signed_request inválido")
    user_id = str(payload.get("user_id", ""))
    for account in db.query(InstagramAccount).filter(InstagramAccount.ig_user_id == user_id).all():
        db.delete(account)
    db.commit()
    code = hashlib.sha256(f"del:{user_id}".encode()).hexdigest()[:16]
    url = str(request.url_for("oauth_data_deletion_status")) + f"?code={code}"
    return {"url": url, "confirmation_code": code}


@router.get("/oauth/data-deletion-status", response_class=HTMLResponse)
def oauth_data_deletion_status(code: str | None = None):
    return _page(f"Dados excluídos. Código de confirmação: {code or '-'}", ok=True)


# --- Agendamentos ------------------------------------------------------------------

@router.get("/posts", response_model=list[InstagramPostOut])
def list_posts(
    client_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(view_permission),
):
    return posts_service.list_posts(db, client_id)


@router.get("/posts/by-entries", response_model=dict[int, InstagramPostOut])
def posts_by_entries(
    ids: str = Query(default="", description="ids de postagens do calendário, separados por vírgula"),
    db: Session = Depends(get_db),
    _: User = Depends(view_permission),
):
    try:
        entry_ids = [int(x) for x in ids.split(",") if x.strip()][:500]
    except ValueError:
        raise _bad_request("ids inválidos")
    return posts_service.latest_by_entries(db, entry_ids)


def _get_post(db: Session, post_id: int) -> InstagramPost:
    post = db.get(InstagramPost, post_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agendamento não encontrado")
    return post


@router.post("/posts", response_model=InstagramPostOut, status_code=201)
def create_post(
    payload: InstagramPostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(manage_permission),
):
    if db.get(Client, payload.client_id) is None:
        raise _bad_request("Cliente inválido")
    try:
        instagram_accounts.get_active_token(db, payload.client_id)
        validate_media(payload.media_type, payload.media_urls)
        caption = posts_service.validate_caption(payload.caption, payload.media_type)
        if payload.calendar_entry_id is not None:
            posts_service.validate_entry_link(db, payload.calendar_entry_id, payload.client_id)
        if payload.publish_now:
            scheduled_at = utcnow()
        elif payload.scheduled_at is None:
            raise posts_service.PostValidationError("Escolha a data e o horário da publicação.")
        else:
            scheduled_at = posts_service.validate_schedule_time(payload.scheduled_at)
        publish_urls = prepare_publish_urls(payload.media_type, payload.media_urls)
    except (instagram_accounts.AccountUnavailable, posts_service.PostValidationError, MediaError) as exc:
        raise _bad_request(str(exc))

    post = InstagramPost(
        client_id=payload.client_id,
        calendar_entry_id=payload.calendar_entry_id,
        media_type=payload.media_type,
        media_urls=list(payload.media_urls),
        publish_urls=publish_urls,
        caption=caption,
        scheduled_at=scheduled_at,
        status="pendente",
        created_by=current_user.id,
    )
    db.add(post)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Essa postagem já tem um agendamento no Instagram.")
    db.refresh(post)

    if payload.publish_now and posts_service.claim(db, post.id):
        posts_service.publish_now_in_background(post.id)
        db.refresh(post)
    return post


def _guard_published_container(db: Session, post: InstagramPost) -> None:
    """Antes de mexer num post que já criou container na Meta: se ele na
    verdade já saiu (resposta perdida), registra como publicado e recusa a edição
    — senão a edição descartaria o container e o post sairia duplicado."""
    if not post.container_id:
        return
    try:
        _, token = instagram_accounts.get_active_token(db, post.client_id)
        state = ig.get_container_status(container_id=post.container_id, access_token=token).get("status_code")
    except (instagram_accounts.AccountUnavailable, ig.InstagramApiError):
        return
    if state == "PUBLISHED":
        if posts_service.claim_if_editable(db, post.id):
            posts_service.publish_now_in_background(post.id)  # a publicação detecta PUBLISHED e só registra
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Esse post já foi publicado no Instagram — atualize a página.",
        )


@router.patch("/posts/{post_id}", response_model=InstagramPostOut)
def update_post(
    post_id: int,
    payload: InstagramPostUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(manage_permission),
):
    post = _get_post(db, post_id)
    if post.status not in posts_service.EDITABLE_STATUSES:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Esse post já está sendo publicado ou já foi publicado.")

    sent = payload.model_fields_set
    media_type = payload.media_type if "media_type" in sent and payload.media_type else post.media_type
    media_urls = payload.media_urls if "media_urls" in sent and payload.media_urls is not None else post.media_urls
    media_changed = media_type != post.media_type or list(media_urls) != list(post.media_urls)
    caption = payload.caption if "caption" in sent else post.caption

    values: dict = {}
    try:
        if media_changed:
            values["media_type"] = media_type
            values["media_urls"] = list(media_urls)
            values["publish_urls"] = prepare_publish_urls(media_type, list(media_urls))
        new_caption = posts_service.validate_caption(caption, media_type)
        if new_caption != post.caption:
            values["caption"] = new_caption
        if "scheduled_at" in sent and payload.scheduled_at is not None:
            values["scheduled_at"] = posts_service.validate_schedule_time(payload.scheduled_at)
            # Reagendar um post com erro devolve ele pra fila.
            values.update(posts_service.reset_for_retry_values())
    except (posts_service.PostValidationError, MediaError) as exc:
        raise _bad_request(str(exc))

    if not values:
        return post
    if "media_type" in values or "caption" in values:
        # Conteúdo mudou: o container já criado na Meta tem o conteúdo antigo.
        _guard_published_container(db, post)
        values["container_id"] = None
        values["container_ig_user_id"] = None
    try:
        return posts_service.update_fields(db, post_id, values)
    except posts_service.PostConflict as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.post("/posts/{post_id}/publish-now", response_model=InstagramPostOut, status_code=202)
def publish_now(post_id: int, db: Session = Depends(get_db), _: User = Depends(manage_permission)):
    """Publica já (ou tenta de novo um post com erro). Responde 202 com o post em
    "publicando"; o resultado aparece na listagem."""
    post = _get_post(db, post_id)
    try:
        instagram_accounts.get_active_token(db, post.client_id)
        posts_service.claim_for_publish_now(db, post_id)
    except instagram_accounts.AccountUnavailable as exc:
        raise _bad_request(str(exc))
    except posts_service.PostConflict as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except posts_service.PostValidationError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    posts_service.publish_now_in_background(post_id)
    db.refresh(post)
    return post


@router.delete("/posts/{post_id}", status_code=204)
def delete_post(post_id: int, db: Session = Depends(get_db), _: User = Depends(manage_permission)):
    _get_post(db, post_id)
    try:
        posts_service.delete_post(db, post_id)
    except posts_service.PostConflict as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


# --- Métricas ---------------------------------------------------------------------

@router.get("/posts/{post_id}/insights", response_model=InsightsOut)
def post_insights(post_id: int, db: Session = Depends(get_db), _: User = Depends(view_permission)):
    post = _get_post(db, post_id)
    try:
        return InsightsOut(metrics=instagram_insights.get_post_insights(db, post))
    except (instagram_accounts.AccountUnavailable, instagram_insights.InsightsError) as exc:
        raise _bad_request(str(exc))
    except ig.InstagramApiError as exc:
        raise _meta_error(db, post.client_id, exc)


@router.get("/insights/account/{client_id}", response_model=InsightsOut)
def account_insights(
    client_id: int,
    since: date | None = None,
    until: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(view_permission),
):
    """Sem datas: últimas 24h. Com `since` e `until` (dias inteiros, Brasília): o período somado."""
    if (since is None) != (until is None):
        raise _bad_request("Informe a data inicial e a final.")
    try:
        if since and until:
            instagram_insights.validate_range(since, until)
        metrics, approximate = instagram_insights.get_account_insights(db, client_id, since, until)
    except (instagram_accounts.AccountUnavailable, instagram_insights.InsightsError) as exc:
        raise _bad_request(str(exc))
    except ig.InstagramApiError as exc:
        raise _meta_error(db, client_id, exc)
    return InsightsOut(metrics=metrics, approximate=approximate)


@router.get("/insights/posts/{client_id}", response_model=PostsInsightsOut)
def posts_insights(
    client_id: int,
    since: date,
    until: date,
    db: Session = Depends(get_db),
    _: User = Depends(view_permission),
):
    """Posts da conta no período (inclusive os não agendados pelo CRM) com as métricas de cada um."""
    try:
        instagram_insights.validate_range(since, until)
        return instagram_insights.get_posts_insights(db, client_id, since, until)
    except (instagram_accounts.AccountUnavailable, instagram_insights.InsightsError) as exc:
        raise _bad_request(str(exc))
    except ig.InstagramApiError as exc:
        raise _meta_error(db, client_id, exc)
