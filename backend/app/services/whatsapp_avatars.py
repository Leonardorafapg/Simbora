# backend/app/services/whatsapp_avatars.py
"""Foto de perfil de quem manda mensagem num grupo (aparece ao lado do balão no CRM).

Primeiro procura na agenda da Evolution (`findContacts`, uma chamada que traz todo mundo); o que faltar é
perguntado um a um (`fetchProfilePictureUrl`), poucos por vez — em rajada o WhatsApp responde
"rate-overlimit" (visto com os grupos). Tudo fica em memória por algumas horas: o link da foto do WhatsApp
expira sozinho, então não vale guardar no banco.
"""
import logging
import time

from app.core import evolution_client

logger = logging.getLogger("whatsapp_avatars")

FOUND_TTL_SECONDS = 6 * 60 * 60
MISSING_TTL_SECONDS = 60 * 60  # sem foto (ou privada): pergunta de novo só depois disso
CONTACTS_TTL_SECONDS = 10 * 60
MAX_LOOKUPS_PER_CALL = 5
RATE_LIMIT_PAUSE_SECONDS = 10 * 60
MAX_JIDS_PER_CALL = 60
MAX_CACHE_ENTRIES = 2000

_cache: dict[str, tuple[str | None, float]] = {}
_contacts: dict[str, str] = {}
_contacts_expires = 0.0
_paused_until = 0.0


def reset() -> None:
    """Zera os caches (testes)."""
    global _contacts_expires, _paused_until
    _cache.clear()
    _contacts.clear()
    _contacts_expires = 0.0
    _paused_until = 0.0


def _cached(jid: str, now: float) -> tuple[bool, str | None]:
    hit = _cache.get(jid)
    if hit and hit[1] > now:
        return True, hit[0]
    return False, None


def _prune(now: float) -> None:
    """Tira do cache o que já venceu e, se ainda passar do teto, as entradas mais antigas."""
    if len(_cache) < MAX_CACHE_ENTRIES:
        return
    for jid in [j for j, (_, expires) in _cache.items() if expires <= now]:
        del _cache[jid]
    excess = len(_cache) - MAX_CACHE_ENTRIES + 1
    if excess > 0:
        for jid in sorted(_cache, key=lambda j: _cache[j][1])[:excess]:
            del _cache[jid]


def _remember(jid: str, url: str | None, now: float) -> None:
    _prune(now)
    _cache[jid] = (url, now + (FOUND_TTL_SECONDS if url else MISSING_TTL_SECONDS))


async def _contact_pictures(now: float) -> dict[str, str]:
    global _contacts_expires
    if now < _contacts_expires:
        return _contacts
    try:
        contacts = await evolution_client.find_contacts()
    except Exception as exc:
        logger.warning("Não foi possível ler a agenda da Evolution: %s", getattr(exc, "detail", None) or repr(exc))
        _contacts_expires = now + 60  # tenta de novo daqui a pouco, sem travar
        return _contacts
    _contacts.clear()
    for contact in contacts:
        jid = contact.get("remoteJid") or contact.get("id") or ""
        url = contact.get("profilePicUrl")
        if jid and url:
            _contacts[jid] = url
    _contacts_expires = now + CONTACTS_TTL_SECONDS
    return _contacts


async def pictures(jids: list[str], aliases: dict[str, str] | None = None) -> dict[str, str | None]:
    """jid -> link da foto (None = sem foto ou ainda não descoberta). `aliases` (lid -> número) deixa achar a
    foto guardada no outro identificador da mesma pessoa."""
    global _paused_until
    now = time.monotonic()
    wanted = list(dict.fromkeys(j for j in jids if j))[:MAX_JIDS_PER_CALL]
    result: dict[str, str | None] = {}
    missing: list[str] = []
    for jid in wanted:
        hit, url = _cached(jid, now)
        if hit:
            result[jid] = url
        else:
            missing.append(jid)
    if not missing:
        return result

    contacts = await _contact_pictures(now)
    reverse = {phone: lid for lid, phone in (aliases or {}).items()}
    still: list[str] = []
    for jid in missing:
        url = contacts.get(jid) or contacts.get((aliases or {}).get(jid, "")) or contacts.get(reverse.get(jid, ""))
        if url:
            _remember(jid, url, now)
            result[jid] = url
        else:
            still.append(jid)

    lookups = 0
    for jid in still:
        if lookups >= MAX_LOOKUPS_PER_CALL or time.monotonic() < _paused_until:
            result[jid] = None  # fica pra próxima abertura (sem gravar no cache)
            continue
        lookups += 1
        try:
            url = await evolution_client.fetch_profile_picture(jid)
        except Exception as exc:
            detail = str(getattr(exc, "detail", None) or repr(exc))
            if "rate-overlimit" in detail:
                _paused_until = time.monotonic() + RATE_LIMIT_PAUSE_SECONDS
                result[jid] = None
                continue
            url = None  # foto privada / contato sem foto
        _remember(jid, url, now)
        result[jid] = url
    return result
