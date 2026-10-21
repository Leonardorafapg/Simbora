# backend/tests/conftest.py
"""Testes rodam num SQLite temporário e com a Meta e o R2 simulados — nada
sai pra internet. Rodar com: cd backend && python -m pytest tests"""
import io
import os
import sys
import tempfile
from datetime import date

_tmp = tempfile.mkdtemp(prefix="simbora-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["INSTAGRAM_WORKER_ENABLED"] = "false"
os.environ["INSTAGRAM_APP_ID"] = "app-id"
os.environ["INSTAGRAM_APP_SECRET"] = "app-secret"
os.environ["INSTAGRAM_REDIRECT_URI"] = "https://api.test/api/v1/instagram/oauth/callback"
os.environ["R2_PUBLIC_BASE_URL"] = "https://media.test"
os.environ["SECRET_KEY"] = "test-secret-with-at-least-32-bytes!!"
os.environ["PUBLIC_API_URL"] = "https://api.test"
os.environ["MCP_RESOURCE_URL"] = "https://mcp.test/mcp"
os.environ["MCP_INTROSPECTION_SECRET"] = "introspection-secret-for-tests-only"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app.core import instagram_client as ig  # noqa: E402
from app.core import r2_client  # noqa: E402
from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models.client import Client  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services import instagram_accounts, instagram_media  # noqa: E402
from app.services import instagram_posts as posts_service  # noqa: E402


def image_bytes(width: int, height: int, fmt: str = "PNG", mode: str = "RGBA") -> bytes:
    out = io.BytesIO()
    Image.new(mode, (width, height), (200, 30, 30, 128) if mode == "RGBA" else (200, 30, 30)).save(out, fmt)
    return out.getvalue()


class FakeMeta:
    """Simula a Graph API: containers, publicação, perfil, insights."""

    def __init__(self):
        self.containers: dict[str, dict] = {}
        self.published: list[dict] = []
        self.next_id = 1
        self.fail_publish_after_success = False  # publica, mas a resposta "se perde"
        self.fail_publish: ig.InstagramApiError | None = None
        self.container_initial_status = "FINISHED"
        self.quota = (0, 100)
        self.created_calls = 0
        self.refresh_error: ig.InstagramApiError | None = None

    def _id(self, prefix: str) -> str:
        self.next_id += 1
        return f"{prefix}{self.next_id}"

    def create_container(self, **kw):
        self.created_calls += 1
        cid = self._id("c")
        self.containers[cid] = {"status": self.container_initial_status, **kw}
        return cid

    def get_container_status(self, *, container_id, access_token):
        return {"status_code": self.containers[container_id]["status"], "status": "detalhe"}

    def publish_container(self, *, ig_user_id, container_id, access_token):
        if self.fail_publish:
            raise self.fail_publish
        mid = self._id("m")
        self.containers[container_id]["status"] = "PUBLISHED"
        self.published.append({"id": mid, "container": container_id, "caption": self.containers[container_id].get("caption")})
        if self.fail_publish_after_success:
            raise ig.InstagramApiError("Falha ao publicar: falha de rede (ReadTimeout)", transient=True)
        return mid

    def get_publishing_limit(self, **kw):
        return self.quota

    def get_media(self, *, media_id, access_token):
        return {"id": media_id, "permalink": f"https://instagram.com/p/{media_id}"}

    def list_media(self, **kw):
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+0000")
        return [
            {"id": p["id"], "caption": p["caption"], "timestamp": now, "permalink": f"https://instagram.com/p/{p['id']}",
             "media_type": "IMAGE", "media_product_type": "FEED", "like_count": 3, "comments_count": 1}
            for p in reversed(self.published)
        ]

    def refresh_long_lived(self, *, access_token):
        if self.refresh_error:
            raise self.refresh_error
        return {"access_token": "renewed-token", "expires_in": 5184000}


@pytest.fixture()
def meta(monkeypatch):
    fake = FakeMeta()
    for name in ("create_container", "get_container_status", "publish_container", "get_publishing_limit",
                 "get_media", "list_media", "refresh_long_lived"):
        monkeypatch.setattr(ig, name, getattr(fake, name))
    monkeypatch.setattr(posts_service, "CONTAINER_POLL_SECONDS", 0)
    return fake


@pytest.fixture()
def r2(monkeypatch):
    stored: dict[str, bytes] = {}
    monkeypatch.setattr(r2_client, "is_configured", lambda: True)
    monkeypatch.setattr(r2_client, "put_object", lambda key, ct, body: stored.__setitem__(key, body))
    downloads: dict[str, bytes] = {}
    monkeypatch.setattr(instagram_media, "_download", lambda url: downloads[url])
    return {"stored": stored, "downloads": downloads}


@pytest.fixture()
def sync_publish(monkeypatch):
    """"Publicar agora" roda na hora (sem thread), pra o teste enxergar o resultado."""
    monkeypatch.setattr(posts_service, "publish_now_in_background", posts_service.publish_claimed)


@pytest.fixture()
def db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture()
def admin(db):
    user = User(
        full_name="Admin", cpf="00000000000", birth_date=date(1990, 1, 1), email="a@a.com",
        password_hash=hash_password("x"), cargo="Admin", is_admin=True, permissions=[],
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def client_row(db):
    row = Client(name="Cliente Teste")
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@pytest.fixture()
def account(db, client_row):
    return instagram_accounts.save_connection(
        db, client_id=client_row.id, ig_user_id="ig-1", username="cliente", profile_picture_url=None,
        access_token="token-1", expires_in=5184000, connected_by=None,
    )


@pytest.fixture()
def api(admin):
    test_client = TestClient(app)
    test_client.headers["Authorization"] = f"Bearer {create_access_token(admin)}"
    return test_client
