# backend/app/services/instagram_insights.py
"""Métricas do Instagram: perfil, conta por período e posts do período (direto
da Meta, inclusive posts que não foram agendados pelo CRM)."""
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy.orm import Session

from app.core import instagram_client as ig
from app.models.instagram import InstagramPost
from app.services import instagram_accounts
from app.services.instagram_posts import BRT

# A Meta aceita no máximo ~30 dias por consulta de métricas da conta.
ACCOUNT_WINDOW_DAYS = 29
MAX_RANGE_DAYS = 400
# Contas únicas: somar janelas conta a mesma pessoa mais de uma vez.
NON_ADDITIVE_METRICS = ("reach", "accounts_engaged")
MAX_POSTS_WITH_INSIGHTS = 60
POST_TOTAL_METRICS = ("views", "reach", "likes", "comments", "saved", "shares", "total_interactions")


class InsightsError(Exception):
    pass


def validate_range(since: date, until: date) -> None:
    today = datetime.now(BRT).date()
    if since > until:
        raise InsightsError("A data inicial precisa ser antes da final.")
    if until > today:
        raise InsightsError("A data final não pode estar no futuro.")
    if (until - since).days > MAX_RANGE_DAYS:
        raise InsightsError(f"O período pode ter no máximo {MAX_RANGE_DAYS} dias.")


def account_windows(since: date, until: date, *, now: datetime | None = None) -> list[tuple[int, int]]:
    """[since, until] (dias inteiros, Brasília) em janelas de até 29 dias, em unix.
    A última termina no máximo agora (a Meta não aceita futuro)."""
    now = now or datetime.now(timezone.utc)
    cursor = datetime.combine(since, time(0), BRT)
    end = min(datetime.combine(until + timedelta(days=1), time(0), BRT), now)
    windows: list[tuple[int, int]] = []
    while cursor < end:
        window_end = min(cursor + timedelta(days=ACCOUNT_WINDOW_DAYS), end)
        windows.append((int(cursor.timestamp()), int(window_end.timestamp())))
        cursor = window_end
    return windows


def get_profile(db: Session, client_id: int) -> dict:
    account, token = instagram_accounts.get_active_token(db, client_id)
    profile = ig.get_profile(access_token=token)
    # Mantém foto/@ salvos atualizados (o cliente pode ter trocado).
    changed = False
    if profile.get("username") and profile["username"] != account.username:
        account.username, changed = profile["username"], True
    if profile.get("profile_picture_url") != account.profile_picture_url:
        account.profile_picture_url, changed = profile.get("profile_picture_url"), True
    if changed:
        db.commit()
    return profile


def get_account_insights(db: Session, client_id: int, since: date | None, until: date | None) -> tuple[dict[str, int], list[str]]:
    """(métricas, métricas aproximadas). Sem datas: últimas 24h."""
    account, token = instagram_accounts.get_active_token(db, client_id)
    ig_user_id = account.ig_user_id
    if since is None or until is None:
        return ig.get_account_insights(ig_user_id=ig_user_id, access_token=token), []

    windows = account_windows(since, until)
    if not windows:
        return {}, []
    with ThreadPoolExecutor(max_workers=4) as pool:
        parts = list(pool.map(
            lambda w: ig.get_account_insights(ig_user_id=ig_user_id, access_token=token, since=w[0], until=w[1]),
            windows,
        ))
    totals: dict[str, int] = {}
    for part in parts:
        for name, value in part.items():
            totals[name] = totals.get(name, 0) + value
    approximate = [m for m in NON_ADDITIVE_METRICS if m in totals] if len(windows) > 1 else []
    return totals, approximate


def normalize_media_type(raw: dict) -> str | None:
    """Tipo do CRM a partir do que a Graph API informa (Stories ficam de fora)."""
    product = raw.get("media_product_type")
    kind = raw.get("media_type")
    if product == "STORY":
        return None
    if product == "REELS":
        return "REELS"
    return {"IMAGE": "IMAGE", "VIDEO": "VIDEO", "CAROUSEL_ALBUM": "CAROUSEL"}.get(kind or "")


def get_posts_insights(db: Session, client_id: int, since: date, until: date) -> dict:
    account, token = instagram_accounts.get_active_token(db, client_id)
    start = datetime.combine(since, time(0), BRT)
    end = datetime.combine(until + timedelta(days=1), time(0), BRT)
    raw_posts = ig.list_media(ig_user_id=account.ig_user_id, access_token=token, since_ts=int(start.timestamp()))

    in_period: list[tuple[dict, str, datetime]] = []
    for raw in raw_posts:
        posted = ig.parse_timestamp(raw.get("timestamp"))
        kind = normalize_media_type(raw)
        if posted is not None and kind is not None and start <= posted < end and raw.get("id"):
            in_period.append((raw, kind, posted))
    in_period.sort(key=lambda t: t[2], reverse=True)
    shown = in_period[:MAX_POSTS_WITH_INSIGHTS]

    def fetch(item: tuple[dict, str, datetime]) -> dict[str, int] | None:
        raw, kind, _ = item
        try:
            return ig.get_media_insights(media_id=raw["id"], media_type=kind, access_token=token)
        except ig.InstagramApiError as exc:
            if exc.is_auth_error:
                raise
            return None  # post sem métricas (muito novo/antigo) não derruba a lista

    with ThreadPoolExecutor(max_workers=5) as pool:
        results = list(pool.map(fetch, shown))

    posts: list[dict] = []
    totals = {m: 0 for m in POST_TOTAL_METRICS}
    by_type: dict[str, int] = {}
    for (raw, kind, posted), metrics in zip(shown, results):
        merged = dict(metrics or {})
        # Curtidas e comentários vêm na listagem — valem mesmo sem insights.
        merged.setdefault("likes", raw.get("like_count") or 0)
        merged.setdefault("comments", raw.get("comments_count") or 0)
        for name in POST_TOTAL_METRICS:
            totals[name] += merged.get(name, 0)
        by_type[kind] = by_type.get(kind, 0) + 1
        posts.append({
            "id": raw["id"],
            "caption": raw.get("caption"),
            "media_type": kind,
            "thumbnail_url": raw.get("thumbnail_url") or raw.get("media_url"),
            "permalink": raw.get("permalink"),
            "posted_at": posted,
            "metrics": merged,
            "insights_available": metrics is not None,
        })
    return {
        "posts": posts,
        "totals": totals,
        "by_type": by_type,
        "total_posts": len(in_period),
        "truncated": len(in_period) > len(shown),
    }


def get_post_insights(db: Session, post: InstagramPost) -> dict[str, int]:
    if post.status != "publicado" or not post.ig_media_id:
        raise InsightsError("As métricas aparecem depois que o post for publicado.")
    _, token = instagram_accounts.get_active_token(db, post.client_id)
    return ig.get_media_insights(media_id=post.ig_media_id, media_type=post.media_type, access_token=token)
