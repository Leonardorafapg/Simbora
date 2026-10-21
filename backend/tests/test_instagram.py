# backend/tests/test_instagram.py
import io
from datetime import date, datetime, timedelta, timezone

from PIL import Image

from app.core import instagram_client as ig
from app.models.calendar_entry import CalendarEntry
from app.models.instagram import InstagramAccount, InstagramPost, utcnow
from app.services import instagram_accounts
from app.services import instagram_posts as posts_service
from tests.conftest import image_bytes

PNG_URL = "https://media.test/simbora-crm/2026/10/arte.png"


def future(hours: int = 2) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


def make_post(db, client_id, **kw) -> InstagramPost:
    post = InstagramPost(
        client_id=client_id, media_type="IMAGE", media_urls=[PNG_URL],
        publish_urls=["https://media.test/simbora-crm/instagram/2026/10/a.jpg"], caption="Legenda",
        scheduled_at=utcnow() - timedelta(minutes=1), status="pendente", **kw,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


def run(db, post: InstagramPost) -> InstagramPost:
    assert posts_service.claim(db, post.id)
    posts_service.publish_claimed(post.id)
    db.expire_all()
    return db.get(InstagramPost, post.id)


# --- Agendamento pela API ----------------------------------------------------------

def test_create_converts_png_to_jpeg_and_stores_utc(api, db, account, r2, client_row):
    r2["downloads"][PNG_URL] = image_bytes(1080, 1350)
    res = api.post("/api/v1/instagram/posts", json={
        "client_id": client_row.id, "media_type": "IMAGE", "media_urls": [PNG_URL],
        "caption": "Oi", "scheduled_at": "2099-01-10T14:00:00-03:00",
    })
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["scheduled_at"].startswith("2099-01-10T17:00:00")  # 14h de Brasília = 17h UTC
    assert body["scheduled_at"].endswith(("Z", "+00:00"))
    post = db.get(InstagramPost, body["id"])
    assert post.publish_urls[0].endswith(".jpg") and "/instagram/" in post.publish_urls[0]
    jpeg = next(iter(r2["stored"].values()))
    assert Image.open(io.BytesIO(jpeg)).format == "JPEG"


def test_naive_time_is_brasilia(api, db, account, r2, client_row):
    r2["downloads"][PNG_URL] = image_bytes(1080, 1080)
    res = api.post("/api/v1/instagram/posts", json={
        "client_id": client_row.id, "media_type": "IMAGE", "media_urls": [PNG_URL], "scheduled_at": "2099-01-10T14:00:00",
    })
    assert res.json()["scheduled_at"].startswith("2099-01-10T17:00:00")


def test_rejects_bad_aspect_ratio(api, account, r2, client_row):
    r2["downloads"][PNG_URL] = image_bytes(1080, 1920)  # 9:16 não vai pro feed
    res = api.post("/api/v1/instagram/posts", json={
        "client_id": client_row.id, "media_type": "IMAGE", "media_urls": [PNG_URL], "scheduled_at": future(),
    })
    assert res.status_code == 400
    assert "proporção" in res.json()["detail"]


def test_story_accepts_vertical_and_drops_caption(api, db, account, r2, client_row):
    r2["downloads"][PNG_URL] = image_bytes(1080, 1920)
    res = api.post("/api/v1/instagram/posts", json={
        "client_id": client_row.id, "media_type": "STORIES", "media_urls": [PNG_URL],
        "caption": "ignorada", "scheduled_at": future(),
    })
    assert res.status_code == 201, res.text
    assert res.json()["caption"] is None


def test_validation_errors(api, account, r2, client_row):
    base = {"client_id": client_row.id, "scheduled_at": future()}
    cases = [
        ({"media_type": "CAROUSEL", "media_urls": [PNG_URL]}, "2 a 10"),
        ({"media_type": "REELS", "media_urls": [PNG_URL]}, "vídeo"),
        ({"media_type": "IMAGE", "media_urls": ["https://outro.site/a.png"]}, "enviadas pelo CRM"),
        ({"media_type": "IMAGE", "media_urls": [PNG_URL], "caption": "x" * 2201}, "2200"),
        ({"media_type": "IMAGE", "media_urls": [PNG_URL], "caption": " ".join(f"#t{i}" for i in range(31))}, "hashtags"),
        ({"media_type": "IMAGE", "media_urls": [PNG_URL], "scheduled_at": "2020-01-01T10:00:00-03:00"}, "já passou"),
    ]
    for extra, expected in cases:
        res = api.post("/api/v1/instagram/posts", json={**base, **extra})
        assert res.status_code == 400, (extra, res.text)
        assert expected in res.json()["detail"], (expected, res.json())


def test_requires_connected_account(api, r2, client_row):
    res = api.post("/api/v1/instagram/posts", json={
        "client_id": client_row.id, "media_type": "IMAGE", "media_urls": [PNG_URL], "scheduled_at": future(),
    })
    assert res.status_code == 400
    assert "não tem Instagram" in res.json()["detail"]


def test_publish_now_publishes(api, db, account, r2, meta, sync_publish, client_row):
    r2["downloads"][PNG_URL] = image_bytes(1080, 1080, "JPEG", "RGB")
    res = api.post("/api/v1/instagram/posts", json={
        "client_id": client_row.id, "media_type": "IMAGE", "media_urls": [PNG_URL], "caption": "Agora", "publish_now": True,
    })
    assert res.status_code == 201, res.text
    db.expire_all()
    post = db.get(InstagramPost, res.json()["id"])
    assert post.status == "publicado"
    assert post.ig_media_id and post.permalink
    assert len(meta.published) == 1


# --- Publicação e proteção contra duplicidade -------------------------------------------

def test_lost_publish_response_does_not_duplicate(db, account, meta, client_row):
    meta.fail_publish_after_success = True
    post = run(db, make_post(db, client_row.id))
    assert post.status == "publicado"  # descobriu pelo status do container
    assert len(meta.published) == 1


def test_crash_after_publish_is_recovered_without_duplicate(db, account, meta, client_row):
    post = make_post(db, client_row.id)
    # Simula: container criado e publicado na Meta, mas o servidor morreu antes de gravar o resultado.
    cid = meta.create_container(caption="Legenda")
    meta.containers[cid]["status"] = "PUBLISHED"
    meta.published.append({"id": "m-old", "container": cid, "caption": "Legenda"})
    post.status = "publicando"
    post.container_id, post.container_ig_user_id = cid, "ig-1"
    post.heartbeat_at = utcnow() - timedelta(minutes=30)
    db.commit()

    assert posts_service.recover_stale(db) == 1
    db.refresh(post)
    assert post.status == "pendente"
    post = run(db, post)
    assert post.status == "publicado"
    assert post.ig_media_id == "m-old"
    assert len(meta.published) == 1


def test_recent_heartbeat_is_not_stale(db, client_row):
    post = make_post(db, client_row.id)
    post.status, post.heartbeat_at = "publicando", utcnow() - timedelta(minutes=2)
    db.commit()
    assert posts_service.recover_stale(db) == 0


def test_transient_failure_backs_off_then_errors(db, account, meta, client_row):
    meta.fail_publish = ig.InstagramApiError("Falha ao publicar: instável", transient=True)
    post = make_post(db, client_row.id)
    post = run(db, post)
    assert post.status == "pendente" and post.attempts == 1
    assert post.next_attempt_at > utcnow()
    assert posts_service.due_post_ids(db) == []  # respeita a espera
    for _ in range(2):
        post.next_attempt_at = utcnow() - timedelta(seconds=1)
        db.commit()
        post = run(db, post)
    assert post.status == "erro" and post.attempts == 3
    assert meta.created_calls == 1  # o container FINISHED foi reaproveitado nas novas tentativas


def test_auth_error_marks_account_and_stops(db, account, meta, client_row):
    meta.fail_publish = ig.InstagramApiError("token morto", code=190)
    post = run(db, make_post(db, client_row.id))
    assert post.status == "erro"
    db.refresh(account)
    assert account.status == "expirado"


def test_quota_reached_waits_without_spending_attempt(db, account, meta, client_row):
    meta.quota = (100, 100)
    post = run(db, make_post(db, client_row.id))
    assert post.status == "pendente" and post.attempts == 0
    assert post.next_attempt_at > utcnow() + timedelta(minutes=50)
    assert meta.created_calls == 0


def test_claim_is_exclusive(db, client_row):
    post = make_post(db, client_row.id)
    assert posts_service.claim(db, post.id) is True
    assert posts_service.claim(db, post.id) is False


def test_carousel_creates_children_and_parent(db, account, meta, client_row):
    post = make_post(db, client_row.id)
    post.media_type = "CAROUSEL"
    post.publish_urls = ["https://media.test/x/instagram/a.jpg", "https://media.test/x/b.mp4"]
    db.commit()
    post = run(db, post)
    assert post.status == "publicado"
    kinds = [(c.get("is_carousel_item"), c.get("is_video"), c.get("media_type")) for c in meta.containers.values()]
    assert (True, False, "CAROUSEL_ITEM") in kinds and (True, True, "CAROUSEL_ITEM") in kinds
    assert any(k[2] == "CAROUSEL" for k in kinds)


# --- Edição / cancelamento -------------------------------------------------------------

def test_cannot_edit_or_delete_while_publishing(api, db, client_row):
    post = make_post(db, client_row.id)
    post.status = "publicando"
    db.commit()
    assert api.patch(f"/api/v1/instagram/posts/{post.id}", json={"caption": "nova"}).status_code == 409
    assert api.delete(f"/api/v1/instagram/posts/{post.id}").status_code == 409


def test_cannot_republish_published(api, db, account, client_row):
    post = make_post(db, client_row.id)
    post.status = "publicado"
    db.commit()
    assert api.post(f"/api/v1/instagram/posts/{post.id}/publish-now").status_code == 409
    assert api.patch(f"/api/v1/instagram/posts/{post.id}", json={"caption": "x"}).status_code == 409


def test_reschedule_error_post_returns_to_queue(api, db, account, client_row):
    post = make_post(db, client_row.id)
    post.status, post.attempts, post.error_message = "erro", 3, "falhou"
    db.commit()
    res = api.patch(f"/api/v1/instagram/posts/{post.id}", json={"scheduled_at": future(5)})
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "pendente" and res.json()["attempts"] == 0


def test_edit_caption_clears_container(api, db, account, meta, client_row):
    post = make_post(db, client_row.id)
    cid = meta.create_container(caption="Legenda")
    post.container_id, post.container_ig_user_id = cid, "ig-1"
    db.commit()
    res = api.patch(f"/api/v1/instagram/posts/{post.id}", json={"caption": "Nova legenda"})
    assert res.status_code == 200, res.text
    db.refresh(post)
    assert post.container_id is None and post.caption == "Nova legenda"


def test_edit_refuses_when_container_already_published(api, db, account, meta, sync_publish, client_row):
    post = make_post(db, client_row.id)
    cid = meta.create_container(caption="Legenda")
    meta.containers[cid]["status"] = "PUBLISHED"
    meta.published.append({"id": "m9", "container": cid, "caption": "Legenda"})
    post.status, post.container_id, post.container_ig_user_id = "erro", cid, "ig-1"
    db.commit()
    res = api.patch(f"/api/v1/instagram/posts/{post.id}", json={"caption": "Outra"})
    assert res.status_code == 409
    db.expire_all()
    assert db.get(InstagramPost, post.id).status == "publicado"
    assert len(meta.published) == 1


# --- Vínculo com a Produção ----------------------------------------------------------------

def _entry(db, client_id, user_id, status="finalizados") -> CalendarEntry:
    entry = CalendarEntry(client_id=client_id, scheduled_date=date(2099, 1, 10), theme="Tema", format="",
                          status=status, created_by=user_id, final_image=PNG_URL, caption="Legenda")
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def test_schedule_from_entry_only_once_and_only_approved(api, db, admin, account, r2, client_row):
    r2["downloads"][PNG_URL] = image_bytes(1080, 1080)
    entry = _entry(db, client_row.id, admin.id)
    payload = {"client_id": client_row.id, "media_type": "IMAGE", "media_urls": [PNG_URL],
               "scheduled_at": future(), "calendar_entry_id": entry.id}
    assert api.post("/api/v1/instagram/posts", json=payload).status_code == 201
    second = api.post("/api/v1/instagram/posts", json=payload)
    assert second.status_code == 400 and "já tem um agendamento" in second.json()["detail"]

    draft = _entry(db, client_row.id, admin.id, status="producao")
    res = api.post("/api/v1/instagram/posts", json={**payload, "calendar_entry_id": draft.id})
    assert res.status_code == 400 and "aprovada" in res.json()["detail"]


def test_moving_entry_back_cancels_pending(api, db, admin, client_row):
    entry = _entry(db, client_row.id, admin.id)
    post = make_post(db, client_row.id, calendar_entry_id=entry.id)
    post_id = post.id
    res = api.patch(f"/api/v1/calendar-entries/{entry.id}", json={"status": "modificacoes"})
    assert res.status_code == 200, res.text
    db.expire_all()
    assert db.get(InstagramPost, post_id) is None


def test_deleting_entry_keeps_published_history(api, db, admin, client_row):
    entry = _entry(db, client_row.id, admin.id)
    published = make_post(db, client_row.id, calendar_entry_id=entry.id)
    published.status = "publicado"
    db.commit()
    res = api.delete(f"/api/v1/calendar-entries/{entry.id}")
    assert res.status_code == 204, res.text
    db.expire_all()
    kept = db.get(InstagramPost, published.id)
    assert kept is not None and kept.calendar_entry_id is None


def test_by_entries_badge(api, db, admin, client_row):
    entry = _entry(db, client_row.id, admin.id)
    make_post(db, client_row.id, calendar_entry_id=entry.id)
    res = api.get(f"/api/v1/instagram/posts/by-entries?ids={entry.id},999")
    assert res.status_code == 200
    assert list(res.json().keys()) == [str(entry.id)]


# --- Conta / token ----------------------------------------------------------------------

def test_disconnect_keeps_history(api, db, account, client_row):
    post = make_post(db, client_row.id)
    post.status = "publicado"
    db.commit()
    assert api.delete(f"/api/v1/instagram/accounts/{client_row.id}").status_code == 204
    db.expire_all()
    acc = db.get(InstagramAccount, account.id)
    assert acc.status == "desconectado" and acc.access_token_encrypted is None
    assert db.get(InstagramPost, post.id) is not None
    assert api.get(f"/api/v1/instagram/accounts/{client_row.id}").json()["status"] == "desconectado"


def test_transient_refresh_failure_keeps_account_active(db, account, meta):
    account.token_expires_at = utcnow() + timedelta(days=3)
    account.last_refreshed_at = utcnow() - timedelta(days=50)
    db.commit()
    meta.refresh_error = ig.InstagramApiError("rede", transient=True)
    instagram_accounts.renew_expiring_tokens(db)
    db.refresh(account)
    assert account.status == "ativo" and account.last_error

    meta.refresh_error = ig.InstagramApiError("morto", code=190)
    instagram_accounts.renew_expiring_tokens(db)
    db.refresh(account)
    assert account.status == "expirado"


def test_refresh_success_extends_token(db, account, meta):
    account.token_expires_at = utcnow() + timedelta(days=3)
    account.last_refreshed_at = utcnow() - timedelta(days=50)
    db.commit()
    instagram_accounts.renew_expiring_tokens(db)
    db.refresh(account)
    assert account.token_expires_at > utcnow() + timedelta(days=50)
    _, token = instagram_accounts.get_active_token(db, account.client_id)
    assert token == "renewed-token"


def test_token_is_encrypted_at_rest(db, account):
    assert "token-1" not in account.access_token_encrypted


# --- OAuth ----------------------------------------------------------------------------

def test_callback_escapes_error_param(api):
    res = api.get("/api/v1/instagram/oauth/callback", params={"error": "<script>alert(1)</script>"})
    assert res.status_code == 200
    assert "<script>alert(1)</script>" not in res.text
    assert "&lt;script&gt;" in res.text


def test_callback_rejects_forged_state(api):
    res = api.get("/api/v1/instagram/oauth/callback", params={"code": "abc", "state": "forjado"})
    assert "inválido ou expirado" in res.text


def test_connect_flow_saves_account(api, db, client_row, monkeypatch):
    monkeypatch.setattr(ig, "exchange_code", lambda **kw: {"access_token": "short", "user_id": 1})
    monkeypatch.setattr(ig, "exchange_long_lived", lambda **kw: {"access_token": "long", "expires_in": 5184000})
    monkeypatch.setattr(ig, "get_profile", lambda **kw: {"id": "ig-77", "username": "loja"})
    url = api.get(f"/api/v1/instagram/oauth/connect-url?client_id={client_row.id}").json()["url"]
    state = url.split("state=")[1]
    res = api.get("/api/v1/instagram/oauth/callback", params={"code": "abc#_", "state": state})
    assert "@loja conectado" in res.text
    acc = instagram_accounts.get_by_client(db, client_row.id)
    assert acc.ig_user_id == "ig-77" and acc.status == "ativo"


def test_deauthorize_requires_valid_signature(api):
    res = api.post("/api/v1/instagram/oauth/deauthorize", data={"signed_request": "abc.def"})
    assert res.status_code == 400


def test_account_windows_split_long_ranges():
    from app.services.instagram_insights import account_windows
    now = datetime(2026, 10, 16, 12, tzinfo=timezone.utc)
    windows = account_windows(date(2026, 7, 1), date(2026, 10, 16), now=now)
    assert len(windows) == 4
    assert all(b - a <= 29 * 86400 for a, b in windows)
    assert windows[-1][1] == int(now.timestamp())


def test_auth_error_on_insights_marks_account(api, db, account, client_row, monkeypatch):
    def boom(**kw):
        raise ig.InstagramApiError("token morto", code=190)
    monkeypatch.setattr(ig, "get_account_insights", boom)
    res = api.get(f"/api/v1/instagram/insights/account/{client_row.id}")
    assert res.status_code == 502
    db.refresh(account)
    assert account.status == "expirado"
