import asyncio
import base64
import logging
import re
import time
import unicodedata
from urllib.parse import quote

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from sqlalchemy.orm import Session

from app.core import evolution_client
from app.core.config import settings
from app.core.database import SessionLocal, get_db
from app.core.deps import require_admin, require_permission
from app.core.security import decode_access_token
from app.core.ws_manager import manager as ws_manager
from app.models.client import Client
from app.models.user import User
from app.schemas.whatsapp import (
    QRCodeResponse,
    SendMessageInput,
    TypingInput,
    WhatsAppChat,
    WhatsAppLabel,
    WhatsAppMessage,
    WhatsAppStatus,
)
from app.services import whatsapp_aliases, whatsapp_groups, whatsapp_store
from app.services.whatsapp_format import (
    display_name,
    extract_media,
    media_kind_for_upload,
    message_preview,
    phone_from_jid,
    pick_group_name,
)

logger = logging.getLogger("whatsapp_router")

router = APIRouter()


# Dados completos dos grupos (tamanho, descrição, assunto) em memória.
# `fetchAllGroups` consulta o WhatsApp ao vivo e leva até ~2 min com muitos
# grupos — por isso nunca roda dentro do request da lista: a lista usa o cache
# e, se ele estiver velho, dispara uma atualização em segundo plano (uma por
# vez). O NOME do grupo não depende disso: vem do `findContacts`, que é rápido.
_GROUPS_TTL_SECONDS = 600
_GROUPS_RETRY_SECONDS = 60
_group_info: dict[str, dict] = {}
_groups_next_refresh = 0.0
_groups_refresh_task: asyncio.Task | None = None
# Webhook registrado neste processo? Garante que instância já conectada antes
# de um deploy passe a receber eventos novos (ex.: etiquetas) sem reconectar.
_webhook_synced = False


def _persist_groups(groups: list[dict]) -> None:
    """Salva os nomes descobertos (sobrevivem a deploy). Nunca derruba quem chamou."""
    if not groups:
        return
    db = SessionLocal()
    try:
        whatsapp_groups.save(db, groups)
    except Exception:
        logger.exception("Não foi possível salvar o nome dos grupos")
    finally:
        db.close()


async def _refresh_group_info() -> None:
    global _groups_next_refresh
    try:
        info: dict[str, dict] = {}
        for group in await evolution_client.fetch_all_groups():
            jid = group.get("id") or group.get("remoteJid") or ""
            if jid:
                info[jid] = group
        _group_info.update(info)
        _persist_groups(list(info.values()))
        _groups_next_refresh = time.monotonic() + _GROUPS_TTL_SECONDS
    except Exception as exc:
        # Falha esperada (timeout da Evolution) — mantém o cache antigo e tenta
        # de novo daqui a pouco, sem traceback enorme no log.
        detail = getattr(exc, "detail", None) or repr(exc)
        logger.warning("Não foi possível buscar grupos na Evolution (mantendo cache): %s", detail)
        _groups_next_refresh = time.monotonic() + _GROUPS_RETRY_SECONDS


# Grupos que a consulta individual não achou: não tenta de novo antes disso.
_GROUP_LOOKUP_RETRY_SECONDS = 15 * 60  # grupo que a Evolution recusa (ex.: o número saiu) não precisa ser perguntado toda hora
_group_lookup_retry_at: dict[str, float] = {}
_GROUP_LOOKUP_MAX_PER_REQUEST = 40
_GROUP_LOOKUP_BUDGET_SECONDS = 8.0


async def _lookup_missing_groups(jids: list[str]) -> None:
    """Completa o cache com os grupos que o `fetchAllGroups` (lento) ainda não trouxe,
    um a um e em paralelo, com teto de tempo — a lista nunca fica presa nisso."""
    now = time.monotonic()
    pending = [
        j for j in jids if j not in _group_info and _group_lookup_retry_at.get(j, 0) <= now
    ][:_GROUP_LOOKUP_MAX_PER_REQUEST]
    if not pending:
        return
    gate = asyncio.Semaphore(6)
    found: list[dict] = []

    async def one(jid: str) -> None:
        async with gate:
            try:
                info = await evolution_client.find_group_info(jid)
            except Exception as exc:
                logger.warning(
                    "findGroupInfos falhou para %s: %s", jid, getattr(exc, "detail", None) or repr(exc)
                )
                info = {}
        if info.get("subject"):
            _group_info[jid] = info
            found.append(info if info.get("id") else {**info, "id": jid})
        else:
            _group_lookup_retry_at[jid] = time.monotonic() + _GROUP_LOOKUP_RETRY_SECONDS

    try:
        await asyncio.wait_for(asyncio.gather(*(one(j) for j in pending)), timeout=_GROUP_LOOKUP_BUDGET_SECONDS)
    except asyncio.TimeoutError:
        logger.warning("Busca individual de grupos passou do tempo — o resto fica pra próxima.")
    _persist_groups(found)


# --- contatos com dois identificadores (@lid e número) ----------------------------------------------------
_ALIAS_BACKFILL_INTERVAL_SECONDS = 10 * 60
_alias_next_run = 0.0
_alias_task: asyncio.Task | None = None


async def _run_alias_backfill() -> None:
    db = SessionLocal()
    try:
        result = await whatsapp_aliases.backfill(db)
        if result["found"]:
            logger.info("Contatos @lid juntados com o número: %s", result)
    except Exception:
        logger.exception("Falha ao descobrir o número dos contatos @lid")
    finally:
        db.close()


def _schedule_alias_backfill(db: Session) -> None:
    """Em segundo plano (uma rodada por vez): descobre o número das conversas @lid que ainda estão separadas."""
    global _alias_next_run, _alias_task
    running = _alias_task is not None and not _alias_task.done()
    if running or time.monotonic() < _alias_next_run:
        return
    if not whatsapp_aliases.unresolved_lids(db, limit=1):
        return
    _alias_next_run = time.monotonic() + _ALIAS_BACKFILL_INTERVAL_SECONDS
    _alias_task = asyncio.create_task(_run_alias_backfill())


def _group_info_snapshot() -> dict[str, dict]:
    global _groups_refresh_task
    refreshing = _groups_refresh_task is not None and not _groups_refresh_task.done()
    if not refreshing and time.monotonic() >= _groups_next_refresh:
        _groups_refresh_task = asyncio.create_task(_refresh_group_info())
    return dict(_group_info)


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return " ".join(re.sub(r"[^a-z0-9]+", " ", text.lower()).split())


def _group_jid(value: str | None) -> str | None:
    """`whatsapp_group_id` do cliente aceita o JID inteiro ou só o número."""
    value = (value or "").strip()
    if not value:
        return None
    return value if "@" in value else f"{value}@g.us"


class _ClientMatcher:
    """Liga conversa -> cliente do CRM. Primeiro pelo `whatsapp_group_id`
    (vínculo explícito); sem isso, pelo nome do cliente aparecer no nome do
    grupo (ex.: "MKT BANGALÔ NORDESTE" -> BANGALÔ NORDESTE), escolhendo o nome
    mais longo pra "FERREIRO GRILL IMPERATRIZ" não cair em "FERREIRO GRILL"."""

    def __init__(self, clients: list[Client]):
        self.by_jid = {jid: c for c in clients if (jid := _group_jid(c.whatsapp_group_id))}
        self.by_name = sorted(
            ((_normalize(c.name), c) for c in clients if c.name and len(_normalize(c.name)) >= 4),
            key=lambda item: len(item[0]),
            reverse=True,
        )

    def match(self, jid: str, name: str | None) -> tuple[Client | None, bool]:
        if jid in self.by_jid:
            return self.by_jid[jid], True
        if not jid.endswith("@g.us") or not name:
            return None, False
        haystack = f" {_normalize(name)} "
        for needle, client in self.by_name:
            if f" {needle} " in haystack:
                return client, False
        return None, False


async def _safe(coro, what: str) -> list[dict]:
    try:
        return await coro
    except Exception as exc:
        detail = getattr(exc, "detail", None) or repr(exc)
        logger.warning("Não foi possível buscar %s na Evolution (seguindo sem): %s", what, detail)
        return []


def _webhook_url() -> str | None:
    # Normaliza esquema — evita webhook quebrado por faltar o https:// na env var.
    url = (settings.PUBLIC_API_URL or "").strip().rstrip("/")
    if not url:
        return None
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"
    return f"{url}/api/v1/whatsapp/webhook"


def _message_out(message) -> WhatsAppMessage:
    return WhatsAppMessage(
        id=message.message_id,
        remote_jid=message.remote_jid,
        from_me=message.from_me,
        text=message.text,
        timestamp=message.timestamp,
        sender_name=message.sender_name,
        media_type=message.media_type,
        media_mimetype=message.media_mimetype,
        media_filename=message.media_filename,
    )


def _resolve_chat_name(raw: dict, is_group: bool, remote_jid: str) -> str:
    # Em grupo, `pushName`/parte de `name` costuma vir preenchido com o nome
    # de quem mandou a última mensagem, não o nome do grupo — `subject` (ou
    # `name` da própria Evolution pra chat, que reflete o assunto do grupo)
    # tem que vir primeiro. Em conversa individual não tem `subject`, então a
    # ordem original serve.
    if is_group:
        return raw.get("subject") or raw.get("name") or remote_jid
    return raw.get("name") or raw.get("pushName") or remote_jid


def _map_chat_from_evolution(raw: dict) -> WhatsAppChat:
    remote_jid = raw.get("remoteJid") or raw.get("id") or ""
    is_group = remote_jid.endswith("@g.us")
    last_message_raw = raw.get("lastMessage") or {}
    last_message_text = None
    if isinstance(last_message_raw, dict):
        message = last_message_raw.get("message") or {}
        last_message_text = (
            message.get("conversation")
            or (message.get("extendedTextMessage") or {}).get("text")
            or last_message_raw.get("body")
        )
        last_message_text = message_preview(last_message_text, extract_media(message)[0])

    return WhatsAppChat(
        remote_jid=remote_jid,
        name=_resolve_chat_name(raw, is_group, remote_jid),
        is_group=is_group,
        last_message=last_message_text,
        unread_count=raw.get("unreadCount") or raw.get("unread_count") or 0,
        profile_pic_url=raw.get("profilePicUrl") or raw.get("profile_pic_url"),
        updated_at=str(raw.get("updatedAt")) if raw.get("updatedAt") else None,
    )


def _map_message_from_evolution(raw: dict) -> WhatsAppMessage:
    key = raw.get("key") or {}
    message = raw.get("message") or {}
    text = (
        message.get("conversation")
        or (message.get("extendedTextMessage") or {}).get("text")
        or (message.get("imageMessage") or {}).get("caption")
        or (message.get("videoMessage") or {}).get("caption")
        or (message.get("documentMessage") or {}).get("caption")
    )
    media_type, media_mimetype, media_filename = extract_media(message)
    return WhatsAppMessage(
        id=key.get("id"),
        remote_jid=key.get("remoteJid", ""),
        from_me=bool(key.get("fromMe")),
        text=text,
        timestamp=raw.get("messageTimestamp"),
        sender_name=raw.get("pushName"),
        media_type=media_type,
        media_mimetype=media_mimetype,
        media_filename=media_filename,
    )


@router.get("/whatsapp/status", response_model=WhatsAppStatus)
async def get_status(
    _: User = Depends(require_permission("whatsapp.view")),
):
    global _webhook_synced
    state = await evolution_client.get_connection_state()
    if state == "open" and not _webhook_synced:
        # Uma vez por processo (todo deploy): reaplica a lista de eventos do
        # webhook sem precisar desconectar o WhatsApp.
        webhook_url = _webhook_url()
        if webhook_url:
            await evolution_client.set_webhook(webhook_url)
            _webhook_synced = True
    return WhatsAppStatus(connected=state == "open", state=state)


@router.post("/whatsapp/connect", response_model=QRCodeResponse)
async def connect(
    _: User = Depends(require_permission("whatsapp.view")),
):
    result = await evolution_client.connect_instance()

    # Sempre registra o webhook depois de criar/reconectar — a Evolution não
    # garante manter a config numa instância já existente. Best-effort: não
    # pode travar o QR code se isso falhar (ver evolution_client.set_webhook).
    webhook_url = _webhook_url()
    if webhook_url:
        await evolution_client.set_webhook(webhook_url)
    else:
        logger.warning("PUBLIC_API_URL não configurada — webhook do WhatsApp não registrado.")

    return QRCodeResponse(**result)


@router.post("/whatsapp/disconnect", status_code=204)
async def disconnect(
    _: User = Depends(require_permission("whatsapp.view")),
):
    await evolution_client.delete_instance()


@router.get("/whatsapp/chats", response_model=list[WhatsAppChat])
async def list_chats(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("whatsapp.view")),
):
    # Enquanto o webhook não está configurado (ou pra conversa antiga, anterior
    # a ele existir), o banco não tem nada — sem isso a lista aparecia vazia
    # mesmo com histórico real esperando na Evolution. Busca sempre os dois e
    # funde: banco manda em quem já tem (unread/última mensagem corretos), o
    # que só existe na Evolution ainda aparece, só sem esses dois refinamentos.
    # Une o que já dá pra unir (mesmo contato em @lid e em número) antes de listar, e manda descobrir o resto.
    whatsapp_aliases.merge_all_known(db)
    _schedule_alias_backfill(db)
    aliases = whatsapp_aliases.alias_map(db)

    db_chats = whatsapp_store.list_chats(db)
    db_by_jid = {c["remote_jid"]: c for c in db_chats}

    # As três chamadas são independentes — em paralelo, não uma atrás da outra.
    raw_chats, raw_contacts, raw_labels = await asyncio.gather(
        _safe(evolution_client.find_chats(), "conversas"),
        _safe(evolution_client.find_contacts(), "contatos"),
        _safe(evolution_client.find_labels(), "etiquetas"),
    )

    raw_by_jid: dict[str, dict] = {}
    for raw in raw_chats:
        jid = raw.get("remoteJid") or raw.get("id") or ""
        canonical = whatsapp_aliases.resolve_with(aliases, jid)
        if canonical != jid:
            raw = {**raw, "remoteJid": canonical, "id": canonical}
        if canonical:
            raw_by_jid.setdefault(canonical, raw)

    # Nome salvo na agenda / nome do grupo. `findContacts` traz os grupos
    # também (type "group", nome em `pushName`) e responde na hora — é a fonte
    # principal de nome de grupo; `fetchAllGroups` (lento) só complementa.
    contact_by_jid: dict[str, dict] = {}
    for contact in raw_contacts:
        jid = whatsapp_aliases.resolve_with(aliases, contact.get("remoteJid") or contact.get("id") or "")
        if jid:
            contact_by_jid.setdefault(jid, contact)

    label_by_id = {
        str(label["id"]): WhatsAppLabel(
            id=str(label["id"]), name=label.get("name") or "", color=int(label.get("color") or 0)
        )
        for label in raw_labels
        if label.get("id") is not None
    }
    label_ids_by_jid = whatsapp_store.chat_label_ids(db)
    # Nomes já descobertos ficam no banco (sobrevivem a deploy); a memória só cobre o que acabou de chegar.
    group_info = {**_group_info_snapshot(), **whatsapp_groups.load(db)}
    group_jids = {j for j in [*db_by_jid, *raw_by_jid] if j.endswith("@g.us")}
    await _lookup_missing_groups(sorted(j for j in group_jids if j not in group_info))
    group_info = {**group_info, **{j: _group_info[j] for j in group_jids if j in _group_info and j not in group_info}}
    sender_names = whatsapp_store.group_sender_names(db)
    matcher = _ClientMatcher(db.query(Client).filter(Client.is_active.is_(True)).all())

    def _contact_name(jid: str) -> str | None:
        contact = contact_by_jid.get(jid)
        if not contact:
            return None
        return contact.get("pushName") or contact.get("name")

    def _enrich(chat: WhatsAppChat) -> WhatsAppChat:
        jid = chat.remote_jid
        contact = contact_by_jid.get(jid) or {}
        if chat.is_group:
            info = group_info.get(jid) or {}
            # `chat.name` e o nome da agenda podem ser o de quem mandou a última mensagem —
            # só entram se não forem o nome de alguém do grupo (ver pick_group_name).
            own_name = chat.name if chat.name and chat.name != jid else None
            names = sender_names.get(jid, set())
            chat.name = (
                pick_group_name(info.get("subject"), _contact_name(jid), names)
                or pick_group_name(None, own_name, names)
                or jid
            )
            chat.group_size = info.get("size")
            chat.group_description = info.get("desc")
            chat.profile_pic_url = chat.profile_pic_url or info.get("pictureUrl") or contact.get("profilePicUrl")
        else:
            if not chat.name or chat.name == jid:
                chat.name = _contact_name(jid) or jid
            chat.phone = phone_from_jid(jid)
            chat.profile_pic_url = chat.profile_pic_url or contact.get("profilePicUrl")
        chat.name = display_name(jid, chat.name, is_group=chat.is_group, phone=chat.phone)
        chat.labels = [label_by_id[i] for i in label_ids_by_jid.get(jid, []) if i in label_by_id]
        client, linked = matcher.match(jid, chat.name)
        if client:
            chat.client_id, chat.client_name, chat.client_linked = client.id, client.name, linked
        return chat

    result = []
    for jid, chat in db_by_jid.items():
        raw = raw_by_jid.pop(jid, {})
        result.append(
            _enrich(
                WhatsAppChat(
                    remote_jid=jid,
                    # Grupo: o nome salvo no banco é de quem mandou, não do
                    # grupo — _enrich resolve o nome certo.
                    name=None if chat["is_group"] else chat["name"],
                    is_group=chat["is_group"],
                    last_message=chat["last_message"],
                    last_from_me=chat["last_from_me"],
                    unread_count=chat["unread_count"],
                    profile_pic_url=raw.get("profilePicUrl") or raw.get("profile_pic_url"),
                    updated_at=str(chat["updated_at"]) if chat["updated_at"] else None,
                )
            )
        )

    # Sobrou na Evolution e não no banco: conversa que ainda não passou pelo
    # webhook nenhuma vez — mostra do jeito antigo (sem tempo real ainda).
    for raw in raw_by_jid.values():
        result.append(_enrich(_map_chat_from_evolution(raw)))

    def _sort_key(chat: WhatsAppChat) -> float:
        # `updated_at` mistura dois formatos (epoch do banco, ISO da Evolution
        # pra quem ainda não passou pelo webhook) — não dá pra comparar como
        # string direto. Normaliza os dois pra epoch só pra ordenar.
        if not chat.updated_at:
            return 0
        if chat.updated_at.isdigit():
            return float(chat.updated_at)
        try:
            from datetime import datetime

            return datetime.fromisoformat(chat.updated_at.replace("Z", "+00:00")).timestamp()
        except ValueError:
            return 0

    result.sort(key=_sort_key, reverse=True)
    return result


@router.get("/whatsapp/debug/names")
async def debug_names(
    limit: int = Query(default=5, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("whatsapp.view")),
):
    """Diagnóstico (só admin): o que cada fonte da Evolution devolve pro nome dos grupos
    e quais conversas individuais parecem duplicadas (mesmo nome, JIDs diferentes)."""
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Somente administradores.")

    raw_chats, raw_contacts = await asyncio.gather(
        _safe(evolution_client.find_chats(), "conversas"),
        _safe(evolution_client.find_contacts(), "contatos"),
    )
    chat_by_jid = {(c.get("remoteJid") or c.get("id") or ""): c for c in raw_chats}
    contact_by_jid = {(c.get("remoteJid") or c.get("id") or ""): c for c in raw_contacts}
    db_chats = whatsapp_store.list_chats(db)
    sender_names = whatsapp_store.group_sender_names(db)

    groups = []
    for chat in [c for c in db_chats if c["is_group"]][:limit]:
        jid = chat["remote_jid"]
        try:
            live = await evolution_client.find_group_info(jid)
            live_result: object = {k: live.get(k) for k in ("subject", "size", "owner", "creation")} or live
        except Exception as exc:
            live_result = {"erro": str(getattr(exc, "detail", None) or repr(exc))}
        contact = contact_by_jid.get(jid) or {}
        raw = chat_by_jid.get(jid) or {}
        groups.append({
            "jid": jid,
            "findGroupInfos": live_result,
            "cache_fetchAllGroups": (_group_info.get(jid) or {}).get("subject"),
            "findContacts": {k: contact.get(k) for k in ("pushName", "name", "type")},
            "findChats": {k: raw.get(k) for k in ("name", "pushName", "subject")},
            "quem_fala_no_grupo": sorted(sender_names.get(jid, set()))[:8],
        })

    by_name: dict[str, list[str]] = {}
    for chat in db_chats:
        if not chat["is_group"] and chat["name"]:
            by_name.setdefault(chat["name"].strip().lower(), []).append(chat["remote_jid"])
    duplicates = [
        {
            "nome": name,
            "jids": jids,
            "contatos": {j: {k: v for k, v in (contact_by_jid.get(j) or {}).items() if k != "profilePicUrl"} for j in jids},
        }
        for name, jids in by_name.items()
        if len(jids) > 1
    ][:limit]

    return {"grupos": groups, "conversas_duplicadas": duplicates}


@router.get("/whatsapp/chats/{remote_jid}/messages", response_model=list[WhatsAppMessage])
async def get_messages(
    remote_jid: str,
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("whatsapp.view")),
):
    requested_jid = remote_jid
    remote_jid = whatsapp_aliases.resolve(db, requested_jid)
    if remote_jid != requested_jid:
        # Endereço antigo (@lid) de um contato cujo número já sabemos: traz o que ficou gravado nele.
        whatsapp_aliases.merge_lid_into_phone(db, requested_jid, remote_jid)
    messages = whatsapp_store.list_messages(db, remote_jid, limit=limit)

    if not messages:
        # Nada no banco ainda pra essa conversa (comum: webhook só configurado
        # agora, ou conversa nunca recebeu mensagem depois disso) — busca na
        # Evolution como antes E aproveita pra semear o banco, então da
        # próxima vez que abrir essa conversa já sai do banco, mais rápido.
        try:
            raw_messages = await evolution_client.find_messages(remote_jid, limit=limit)
        except Exception:
            logger.warning("Não foi possível buscar mensagens na Evolution.", exc_info=True)
            return []

        is_group = remote_jid.endswith("@g.us")
        for raw in raw_messages:
            key = raw.get("key") or {}
            mapped = _map_message_from_evolution(raw)
            whatsapp_store.save_message(
                db,
                message_id=key.get("id"),
                remote_jid=remote_jid,
                from_me=bool(key.get("fromMe")),
                text=mapped.text,
                sender_name=raw.get("pushName"),
                is_group=is_group,
                status="recebida" if not key.get("fromMe") else "enviada",
                timestamp=raw.get("messageTimestamp") or 0,
                media_type=mapped.media_type,
                media_mimetype=mapped.media_mimetype,
                media_filename=mapped.media_filename,
            )
        messages = whatsapp_store.list_messages(db, remote_jid, limit=limit)

    whatsapp_store.mark_read(db, remote_jid)
    return [_message_out(m) for m in messages]


@router.get("/whatsapp/chats/{remote_jid}/messages/{message_id}/media")
async def get_message_media(
    remote_jid: str,
    message_id: str,
    download: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("whatsapp.view")),
):
    """
    Binário (imagem/vídeo/áudio/documento) de uma mensagem, decodificado sob
    demanda pela Evolution — não fica guardado no banco (ver evolution_client.
    get_media_base64). `download=true` marca a resposta pra baixar em vez de
    abrir inline (usado pelo botão de download do documento no frontend).
    """
    remote_jid = whatsapp_aliases.resolve(db, remote_jid)
    message = whatsapp_store.get_message(db, message_id)
    if message is None or message.remote_jid != remote_jid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mensagem não encontrada.")
    if message.media_type is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Essa mensagem não tem mídia.")

    result = await evolution_client.get_media_base64(remote_jid, message_id, message.from_me)
    raw_base64 = result.get("base64") or ""
    # Evolution às vezes manda como data URI (`data:<mime>;base64,xxx`), às
    # vezes só o base64 cru — cobre os dois pra não quebrar o decode abaixo.
    if "," in raw_base64 and raw_base64.strip().startswith("data:"):
        raw_base64 = raw_base64.split(",", 1)[1]

    try:
        content = base64.b64decode(raw_base64)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível decodificar a mídia."
        ) from exc

    mimetype = result.get("mimetype") or message.media_mimetype or "application/octet-stream"
    headers = {}
    if download:
        ext = mimetype.split("/")[-1].split(";")[0]
        name = message.media_filename or f"whatsapp-{message_id}.{ext}"
        headers["Content-Disposition"] = "attachment; filename*=UTF-8''" + quote(name)

    return Response(content=content, media_type=mimetype, headers=headers)


@router.post("/whatsapp/chats/{remote_jid}/messages", response_model=WhatsAppMessage)
async def send_message(
    remote_jid: str,
    payload: SendMessageInput,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("whatsapp.send")),
):
    remote_jid = whatsapp_aliases.resolve(db, remote_jid)
    result = await evolution_client.send_text_message(remote_jid, payload.text)
    key = result.get("key") or {}

    message = whatsapp_store.save_message(
        db,
        message_id=key.get("id"),
        remote_jid=remote_jid,
        from_me=True,
        text=payload.text,
        sender_name=None,
        is_group=remote_jid.endswith("@g.us"),
        status="enviada",
        timestamp=result.get("messageTimestamp") or 0,
    )
    if message is None:
        # Dedup: já tinha sido salva (não deveria acontecer no envio, mas o
        # dado que importa é devolver a resposta certa mesmo assim).
        out = WhatsAppMessage(
            id=key.get("id"), remote_jid=remote_jid, from_me=True, text=payload.text,
            timestamp=result.get("messageTimestamp"), sender_name=None,
        )
    else:
        out = _message_out(message)
        await ws_manager.broadcast({"type": "whatsapp_message", "message": out.model_dump()})
    return out


# WhatsApp aceita até ~100 MB, mas o arquivo passa em base64 pela Evolution — 25 MB
# cobre PDF/imagem/vídeo curto sem estourar timeout nem memória.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024


@router.post("/whatsapp/chats/{remote_jid}/media", response_model=WhatsAppMessage)
async def send_media(
    remote_jid: str,
    file: UploadFile = File(...),
    caption: str = Form(default=""),
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("whatsapp.send")),
):
    """Envia imagem, vídeo ou documento (qualquer outro tipo) com legenda opcional."""
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="O arquivo está vazio.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="Arquivo grande demais (máximo 25 MB)."
        )

    remote_jid = whatsapp_aliases.resolve(db, remote_jid)
    mimetype = file.content_type or "application/octet-stream"
    file_name = (file.filename or "arquivo").strip()[:255] or "arquivo"
    media_kind = media_kind_for_upload(mimetype)
    caption = caption.strip()

    result = await evolution_client.send_media_base64(
        remote_jid,
        media_kind=media_kind,
        base64_data=base64.b64encode(content).decode(),
        mimetype=mimetype,
        file_name=file_name,
        caption=caption,
    )
    key = result.get("key") or {}

    message = whatsapp_store.save_message(
        db,
        message_id=key.get("id"),
        remote_jid=remote_jid,
        from_me=True,
        text=caption or None,
        sender_name=None,
        is_group=remote_jid.endswith("@g.us"),
        status="enviada",
        timestamp=result.get("messageTimestamp") or int(time.time()),
        media_type=media_kind,
        media_mimetype=mimetype,
        media_filename=file_name,
    )
    if message is None:
        return WhatsAppMessage(
            id=key.get("id"), remote_jid=remote_jid, from_me=True, text=caption or None,
            timestamp=result.get("messageTimestamp"), media_type=media_kind,
            media_mimetype=mimetype, media_filename=file_name,
        )
    out = _message_out(message)
    await ws_manager.broadcast({"type": "whatsapp_message", "message": out.model_dump()})
    return out


@router.post("/whatsapp/chats/{remote_jid}/typing", status_code=204)
async def send_typing(
    remote_jid: str,
    payload: TypingInput,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("whatsapp.send")),
):
    await evolution_client.send_presence(whatsapp_aliases.resolve(db, remote_jid), payload.presence)


@router.post("/whatsapp/maintenance/merge-contacts")
async def merge_contacts(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Admin: junta agora os contatos que aparecem duas vezes (`@lid` e número) — o que já se sabe e o que dá
    pra descobrir lendo a Evolution. Roda sozinho em segundo plano; isto só força na hora."""
    known = whatsapp_aliases.merge_all_known(db)
    discovered = await whatsapp_aliases.backfill(db, limit=200)
    return {"ja_conhecidos": known, "descobertos": discovered, "ainda_separados": len(whatsapp_aliases.unresolved_lids(db, limit=1000))}


@router.websocket("/whatsapp/ws")
async def whatsapp_ws(websocket: WebSocket, token: str = Query(...)):
    """
    Canal de tempo real: mensagem nova (`whatsapp_message`) e presença de
    contato digitando (`whatsapp_presence`) — ver routers/whatsapp_webhook.py.
    Autentica pelo JWT do usuário no query param (WebSocket não manda header
    Authorization pelo navegador).
    """
    try:
        decode_access_token(token)
    except Exception:
        await websocket.close(code=4401)
        return

    await ws_manager.connect(websocket)
    try:
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(websocket)
