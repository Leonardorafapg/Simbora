# backend/app/services/instagram_accounts.py
import logging
from datetime import timedelta

from sqlalchemy.orm import Session

from app.core import instagram_client as ig
from app.core.config import settings
from app.core.crypto import TokenDecryptError, decrypt_token, encrypt_token
from app.models.instagram import InstagramAccount, utcnow

logger = logging.getLogger("instagram")

# Renova quando faltar isso ou menos pra expirar (token dura 60 dias).
RENEWAL_THRESHOLD_DAYS = 7
DEFAULT_TOKEN_SECONDS = 60 * 24 * 60 * 60


class AccountUnavailable(Exception):
    """Cliente sem Instagram ativo — a mensagem já é a que o usuário vê."""


def is_configured() -> bool:
    return bool(settings.INSTAGRAM_APP_ID and settings.INSTAGRAM_APP_SECRET and redirect_uri())


def redirect_uri() -> str:
    if settings.INSTAGRAM_REDIRECT_URI:
        return settings.INSTAGRAM_REDIRECT_URI
    if settings.PUBLIC_API_URL:
        return f"{settings.PUBLIC_API_URL.rstrip('/')}/api/v1/instagram/oauth/callback"
    return ""


def get_by_client(db: Session, client_id: int) -> InstagramAccount | None:
    return db.query(InstagramAccount).filter(InstagramAccount.client_id == client_id).one_or_none()


def get_active_token(db: Session, client_id: int) -> tuple[InstagramAccount, str]:
    """(conta, token em texto puro) ou AccountUnavailable com a mensagem pro usuário."""
    account = get_by_client(db, client_id)
    if account is None or account.status == "desconectado" or not account.access_token_encrypted:
        raise AccountUnavailable("Esse cliente não tem Instagram conectado.")
    if account.status != "ativo":
        raise AccountUnavailable("A conexão com o Instagram desse cliente expirou ou foi revogada — reconecte a conta.")
    if account.token_expires_at and account.token_expires_at <= utcnow():
        mark_expired(db, account, "Token passou da validade sem ser renovado.")
        raise AccountUnavailable("A conexão com o Instagram desse cliente expirou — reconecte a conta.")
    try:
        return account, decrypt_token(account.access_token_encrypted)
    except TokenDecryptError:
        mark_expired(db, account, "Token gravado com outra chave de criptografia.")
        raise AccountUnavailable("Não foi possível ler o token salvo (chave trocada) — reconecte a conta.")


def mark_expired(db: Session, account: InstagramAccount, reason: str) -> None:
    account.status = "expirado"
    account.last_error = reason
    db.commit()


def note_api_error(db: Session, client_id: int, exc: "ig.InstagramApiError") -> None:
    """Token recusado pela Meta (erro 190) em qualquer chamada: a conta passa a
    "expirado" pra tela pedir reconexão, em vez de cada consulta falhar em silêncio."""
    if not exc.is_auth_error:
        return
    account = get_by_client(db, client_id)
    if account is not None and account.status == "ativo":
        mark_expired(db, account, exc.message)


def save_connection(
    db: Session,
    *,
    client_id: int,
    ig_user_id: str,
    username: str | None,
    profile_picture_url: str | None,
    access_token: str,
    expires_in: int | None,
    connected_by: int | None,
) -> InstagramAccount:
    """Cria ou sobrescreve a conexão do cliente (reconectar mantém o mesmo id)."""
    now = utcnow()
    account = get_by_client(db, client_id) or InstagramAccount(client_id=client_id)
    account.ig_user_id = ig_user_id
    account.username = username
    account.profile_picture_url = profile_picture_url
    account.access_token_encrypted = encrypt_token(access_token)
    account.token_expires_at = now + timedelta(seconds=int(expires_in or DEFAULT_TOKEN_SECONDS))
    account.last_refreshed_at = now
    account.status = "ativo"
    account.last_error = None
    account.connected_by = connected_by
    account.connected_at = now
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def disconnect(db: Session, account: InstagramAccount, status: str = "desconectado") -> None:
    """Apaga o token mas mantém a linha — os posts (e o histórico de publicados)
    continuam. No GBRAND isso era um DELETE com CASCADE que levava junto todo
    o histórico de agendamentos do cliente."""
    account.status = status
    account.access_token_encrypted = None
    account.token_expires_at = None
    db.commit()


def renew_expiring_tokens(db: Session) -> None:
    """Chamado pelo laço periódico. Só marca "expirado" quando o token
    realmente morreu (erro 190 ou validade vencida) — no GBRAND qualquer falha
    (até uma queda de rede) derrubava a conexão de vez."""
    now = utcnow()
    accounts = (
        db.query(InstagramAccount)
        .filter(
            InstagramAccount.status == "ativo",
            InstagramAccount.access_token_encrypted.isnot(None),
            InstagramAccount.token_expires_at <= now + timedelta(days=RENEWAL_THRESHOLD_DAYS),
        )
        .all()
    )
    for account in accounts:
        # A Meta só renova token com 24h+ de vida.
        if account.last_refreshed_at and now - account.last_refreshed_at < timedelta(hours=24):
            continue
        try:
            token = decrypt_token(account.access_token_encrypted)
            result = ig.refresh_long_lived(access_token=token)
            account.access_token_encrypted = encrypt_token(result["access_token"])
            account.token_expires_at = utcnow() + timedelta(seconds=int(result.get("expires_in") or DEFAULT_TOKEN_SECONDS))
            account.last_refreshed_at = utcnow()
            account.last_error = None
            db.commit()
        except TokenDecryptError:
            mark_expired(db, account, "Token gravado com outra chave de criptografia.")
        except ig.InstagramApiError as exc:
            if exc.is_auth_error or (account.token_expires_at and account.token_expires_at <= utcnow()):
                logger.warning("Token do Instagram da conta %s morreu: %s", account.id, exc.message)
                mark_expired(db, account, exc.message)
            else:
                logger.warning("Falha temporária ao renovar token da conta %s: %s", account.id, exc.message)
                account.last_error = exc.message
                db.commit()
        except Exception:
            logger.exception("Falha inesperada ao renovar token da conta %s", account.id)
            db.rollback()

    # Tokens que venceram sem renovação (ex.: servidor parado por dias).
    for account in (
        db.query(InstagramAccount)
        .filter(InstagramAccount.status == "ativo", InstagramAccount.token_expires_at <= now)
        .all()
    ):
        mark_expired(db, account, "Token passou da validade sem ser renovado.")
