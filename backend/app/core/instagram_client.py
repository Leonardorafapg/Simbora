# backend/app/core/instagram_client.py
"""
Cliente da "API do Instagram com Login do Instagram" (graph.instagram.com) —
não exige Página do Facebook vinculada. Cada cliente do CRM conecta a própria
conta profissional; o token de longa duração (60 dias) fica criptografado em
instagram_accounts (ver services/instagram_accounts.py).

Tudo aqui é síncrono: o backend usa SQLAlchemy síncrono, as rotas que chamam a
Meta são `def` (rodam no threadpool) e o laço de publicação roda numa thread.

O access_token vai na query string — por isso o logger do httpx fica em WARNING
(ver main.py), senão a URL completa com o token iria pros logs.
"""
import urllib.parse
from datetime import datetime

import httpx

GRAPH_BASE = "https://graph.instagram.com"
AUTH_BASE = "https://www.instagram.com/oauth/authorize"
# A troca do `code` pelo token curto é o único passo no host antigo.
SHORT_TOKEN_URL = "https://api.instagram.com/oauth/access_token"

# Escopos atuais (os business_* antigos foram desativados em jan/2025).
SCOPES = "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights"

# Códigos de erro da Graph API que valem nova tentativa (instabilidade/limite de chamadas).
_TRANSIENT_CODES = {1, 2, 4, 17, 32, 341, 613}

# Mensagens amigáveis pros erros de mídia mais comuns. A mensagem original da
# Meta vai junto entre parênteses, então um código mal mapeado não engana ninguém.
_SUBCODE_MESSAGES = {
    2207003: "O Instagram demorou demais pra baixar a mídia.",
    2207004: "Imagem grande demais (máximo 8 MB).",
    2207009: "Proporção da imagem não aceita (feed: entre 4:5 e 1,91:1).",
    2207020: "A mídia expirou antes de ser publicada.",
    2207026: "Formato de vídeo não aceito (use MP4/MOV, H.264 + AAC).",
    2207042: "Limite diário de publicações pela API atingido nesta conta.",
    2207052: "O Instagram não conseguiu baixar a mídia (link inacessível).",
}


class InstagramApiError(Exception):
    def __init__(
        self,
        message: str,
        *,
        code: int | None = None,
        subcode: int | None = None,
        status: int | None = None,
        transient: bool = False,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.subcode = subcode
        self.status = status
        self.transient = transient

    @property
    def is_auth_error(self) -> bool:
        """Token inválido, expirado ou revogado — só reconectando."""
        return self.code == 190

    @property
    def is_invalid_metric(self) -> bool:
        return self.code == 100 and self.subcode is None


def _error_from_response(resp: httpx.Response, context: str) -> InstagramApiError:
    try:
        body = resp.json()
    except ValueError:
        body = {}
    err = body.get("error") if isinstance(body, dict) else None
    if not isinstance(err, dict):
        err = {}
    code = err.get("code")
    subcode = err.get("error_subcode")
    meta_msg = err.get("error_user_msg") or err.get("message") or resp.text[:300] or f"HTTP {resp.status_code}"
    friendly = _SUBCODE_MESSAGES.get(subcode)
    if code == 190:
        friendly = "A conexão com o Instagram expirou ou foi revogada — reconecte a conta."
    message = f"{context}: {friendly} ({meta_msg})" if friendly else f"{context}: {meta_msg}"
    transient = resp.status_code >= 500 or code in _TRANSIENT_CODES or bool(err.get("is_transient"))
    return InstagramApiError(message, code=code, subcode=subcode, status=resp.status_code, transient=transient)


def _request(method: str, url: str, context: str, *, params=None, files=None, timeout: float = 20) -> dict:
    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.request(method, url, params=params, files=files)
    except httpx.HTTPError as exc:
        # Nunca repassar str(exc) cru: pode conter a URL com o access_token.
        raise InstagramApiError(f"{context}: falha de rede ({type(exc).__name__})", transient=True) from None
    if resp.is_error:
        raise _error_from_response(resp, context)
    try:
        return resp.json()
    except ValueError:
        raise InstagramApiError(f"{context}: resposta inválida da Meta", transient=True) from None


# --- OAuth -----------------------------------------------------------------

def build_authorize_url(*, app_id: str, redirect_uri: str, state: str) -> str:
    params = {
        "client_id": app_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": SCOPES,
        "state": state,
    }
    return f"{AUTH_BASE}?{urllib.parse.urlencode(params)}"


def exchange_code(*, app_id: str, app_secret: str, redirect_uri: str, code: str) -> dict:
    """`code` -> token curto (1h). Essa rota exige multipart/form-data (o
    `files=` com valores (None, str) força a codificação). A resposta pode vir
    envolvida em {"data": [...]}."""
    fields = {
        "client_id": (None, app_id),
        "client_secret": (None, app_secret),
        "grant_type": (None, "authorization_code"),
        "redirect_uri": (None, redirect_uri),
        "code": (None, code),
    }
    body = _request("POST", SHORT_TOKEN_URL, "Falha ao trocar o código pelo token", files=fields)
    data = body.get("data")
    return data[0] if isinstance(data, list) and data else body


def exchange_long_lived(*, app_secret: str, short_token: str) -> dict:
    """Token curto -> token de longa duração (60 dias): {access_token, expires_in}."""
    return _request(
        "GET",
        f"{GRAPH_BASE}/access_token",
        "Falha ao gerar o token de longa duração",
        params={"grant_type": "ig_exchange_token", "client_secret": app_secret, "access_token": short_token},
    )


def refresh_long_lived(*, access_token: str) -> dict:
    """Renova por mais 60 dias. Só funciona com token válido e com 24h+ de vida."""
    return _request(
        "GET",
        f"{GRAPH_BASE}/refresh_access_token",
        "Falha ao renovar o token",
        params={"grant_type": "ig_refresh_token", "access_token": access_token},
    )


# --- Perfil ----------------------------------------------------------------

PROFILE_FIELDS = "id,username,name,biography,followers_count,media_count,profile_picture_url"


def get_profile(*, access_token: str, fields: str = PROFILE_FIELDS) -> dict:
    """`id` (não `user_id`) é o id usado nos endpoints de mídia/insights — o
    GBRAND já errou isso uma vez (commit 748add6)."""
    return _request("GET", f"{GRAPH_BASE}/me", "Falha ao buscar o perfil do Instagram",
                    params={"fields": fields, "access_token": access_token})


# --- Publicação (Content Publishing API) -------------------------------------
# Fluxo: cria o container (a Meta baixa a mídia da URL pública em segundo
# plano), espera ficar FINISHED e publica com media_publish.

def create_container(
    *,
    ig_user_id: str,
    access_token: str,
    media_type: str,
    media_url: str | None = None,
    is_video: bool = False,
    caption: str | None = None,
    is_carousel_item: bool = False,
    children: list[str] | None = None,
) -> str:
    """Devolve o id do container. media_type: IMAGE | REELS | STORIES | CAROUSEL."""
    params: dict = {"access_token": access_token}
    if media_type == "CAROUSEL":
        params["media_type"] = "CAROUSEL"
        params["children"] = ",".join(children or [])
    elif is_carousel_item:
        params["is_carousel_item"] = "true"
        if is_video:
            params["media_type"] = "VIDEO"  # item de carrossel em vídeo ainda é VIDEO
            params["video_url"] = media_url
        else:
            params["image_url"] = media_url
    elif media_type == "STORIES":
        params["media_type"] = "STORIES"  # sem isso a Meta trata como post de feed
        params["video_url" if is_video else "image_url"] = media_url
    elif media_type == "REELS":
        params["media_type"] = "REELS"  # vídeo solto no feed hoje só sai como Reels
        params["video_url"] = media_url
    else:  # IMAGE
        params["image_url"] = media_url

    # Stories não aceitam legenda; item de carrossel também não (vai no pai).
    if caption and media_type != "STORIES" and not is_carousel_item:
        params["caption"] = caption

    body = _request("POST", f"{GRAPH_BASE}/{ig_user_id}/media", "Falha ao criar o container de mídia",
                    params=params, timeout=60)
    container_id = body.get("id")
    if not container_id:
        raise InstagramApiError("Falha ao criar o container de mídia: resposta sem id", transient=True)
    return str(container_id)


def get_container_status(*, container_id: str, access_token: str) -> dict:
    """status_code: EXPIRED | ERROR | FINISHED | IN_PROGRESS | PUBLISHED; `status` traz o detalhe do erro."""
    return _request("GET", f"{GRAPH_BASE}/{container_id}", "Falha ao consultar o container",
                    params={"fields": "status_code,status", "access_token": access_token})


def publish_container(*, ig_user_id: str, container_id: str, access_token: str) -> str:
    body = _request("POST", f"{GRAPH_BASE}/{ig_user_id}/media_publish", "Falha ao publicar",
                    params={"creation_id": container_id, "access_token": access_token}, timeout=60)
    media_id = body.get("id")
    if not media_id:
        raise InstagramApiError("Falha ao publicar: resposta sem id", transient=True)
    return str(media_id)


def get_publishing_limit(*, ig_user_id: str, access_token: str) -> tuple[int, int] | None:
    """(usados nas últimas 24h, total permitido) ou None se a Meta não informar."""
    body = _request("GET", f"{GRAPH_BASE}/{ig_user_id}/content_publishing_limit",
                    "Falha ao consultar o limite de publicações",
                    params={"fields": "quota_usage,config", "access_token": access_token})
    data = body.get("data") or []
    if not data:
        return None
    usage = data[0].get("quota_usage")
    total = (data[0].get("config") or {}).get("quota_total")
    if usage is None or total is None:
        return None
    return int(usage), int(total)


def get_media(*, media_id: str, access_token: str) -> dict:
    return _request("GET", f"{GRAPH_BASE}/{media_id}", "Falha ao buscar a publicação",
                    params={"fields": "id,permalink,timestamp,media_type,media_product_type",
                            "access_token": access_token})


# --- Lista de posts da conta (feed e Reels; Stories não aparecem nesse endpoint) ---

MEDIA_LIST_FIELDS = (
    "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count"
)
MEDIA_LIST_PAGE_SIZE = 50
MEDIA_LIST_MAX_PAGES = 10


def parse_timestamp(value: str | None) -> datetime | None:
    """"2026-09-30T14:00:00+0000" -> datetime com fuso; None se inválido."""
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M:%S%z")
    except ValueError:
        return None


def list_media(*, ig_user_id: str, access_token: str, since_ts: int | None = None, max_items: int | None = None) -> list[dict]:
    """Posts do mais novo pro mais velho, paginando até passar de `since_ts` (unix)."""
    items: list[dict] = []
    url = f"{GRAPH_BASE}/{ig_user_id}/media"
    params: dict | None = {
        "fields": MEDIA_LIST_FIELDS,
        "limit": min(MEDIA_LIST_PAGE_SIZE, max_items or MEDIA_LIST_PAGE_SIZE),
        "access_token": access_token,
    }
    for _ in range(MEDIA_LIST_MAX_PAGES):
        body = _request("GET", url, "Falha ao listar os posts da conta", params=params)
        data = body.get("data") or []
        items.extend(data)
        if max_items and len(items) >= max_items:
            return items[:max_items]
        oldest = parse_timestamp(data[-1].get("timestamp")) if data else None
        next_url = (body.get("paging") or {}).get("next")
        if not next_url or since_ts is None or (oldest is not None and oldest.timestamp() < since_ts):
            break
        url, params = next_url, None  # a URL de "next" já traz todos os parâmetros
    return items


# --- Insights ----------------------------------------------------------------
# Pedir uma métrica que não vale pro tipo de mídia derruba a chamada inteira
# (400), por isso cada tipo tem o seu conjunto e há um conjunto "seguro" de reserva.

MEDIA_METRICS_BY_TYPE: dict[str, str] = {
    "IMAGE": "views,reach,likes,comments,saved,shares,total_interactions",
    "CAROUSEL": "views,reach,likes,comments,saved,shares,total_interactions",
    "VIDEO": "views,reach,likes,comments,saved,shares,total_interactions",
    "REELS": "views,reach,likes,comments,saved,shares,total_interactions,ig_reels_avg_watch_time",
    # Story só tem métricas nas primeiras 24h — depois disso a API erra.
    "STORIES": "views,reach,replies,shares,total_interactions",
}
SAFE_MEDIA_METRICS: dict[str, str] = {
    "STORIES": "reach,replies,total_interactions",
}
SAFE_MEDIA_METRICS_DEFAULT = "reach,likes,comments,saved,shares,total_interactions"

ACCOUNT_METRICS = "reach,accounts_engaged,total_interactions,views,profile_links_taps,likes,comments,saves,shares"
SAFE_ACCOUNT_METRICS = "reach,accounts_engaged,total_interactions,views,profile_links_taps"


def flatten_insights(raw: dict) -> dict[str, int]:
    """{"data": [{"name", "values"|"total_value"}]} -> {nome: valor}."""
    result: dict[str, int] = {}
    for item in raw.get("data", []) or []:
        name = item.get("name")
        if not name:
            continue
        if isinstance(item.get("total_value"), dict):
            value = item["total_value"].get("value", 0)
        elif item.get("values"):
            value = item["values"][0].get("value", 0)
        else:
            continue
        if isinstance(value, (int, float)):
            result[name] = int(value)
    return result


def get_media_insights(*, media_id: str, media_type: str, access_token: str) -> dict[str, int]:
    url = f"{GRAPH_BASE}/{media_id}/insights"
    metrics = MEDIA_METRICS_BY_TYPE.get(media_type, MEDIA_METRICS_BY_TYPE["IMAGE"])
    try:
        raw = _request("GET", url, "Falha ao buscar métricas do post", params={"metric": metrics, "access_token": access_token})
    except InstagramApiError as exc:
        if exc.is_auth_error or exc.transient:
            raise
        safe = SAFE_MEDIA_METRICS.get(media_type, SAFE_MEDIA_METRICS_DEFAULT)
        raw = _request("GET", url, "Falha ao buscar métricas do post", params={"metric": safe, "access_token": access_token})
    return flatten_insights(raw)


def get_account_insights(*, ig_user_id: str, access_token: str, since: int | None = None, until: int | None = None) -> dict[str, int]:
    """Métricas agregadas da conta. Sem since/until: últimas 24h. A Meta limita
    cada consulta a ~30 dias — períodos maiores são quebrados por quem chama."""
    url = f"{GRAPH_BASE}/{ig_user_id}/insights"
    params: dict = {"period": "day", "metric_type": "total_value", "access_token": access_token}
    if since is not None:
        params["since"] = since
    if until is not None:
        params["until"] = until
    try:
        raw = _request("GET", url, "Falha ao buscar métricas da conta", params={**params, "metric": ACCOUNT_METRICS})
    except InstagramApiError as exc:
        if exc.is_auth_error or exc.transient:
            raise
        raw = _request("GET", url, "Falha ao buscar métricas da conta", params={**params, "metric": SAFE_ACCOUNT_METRICS})
    return flatten_insights(raw)
