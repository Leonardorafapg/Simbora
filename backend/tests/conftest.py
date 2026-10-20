# backend/tests/conftest.py
"""Testes rodam num SQLite temporário — nada sai pra internet. Rodar com: cd backend && python -m pytest tests"""
import os
import sys
import tempfile
from datetime import date

_tmp = tempfile.mkdtemp(prefix="simbora-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["SECRET_KEY"] = "test-secret-with-at-least-32-bytes!!"
os.environ["PUBLIC_API_URL"] = "https://api.test"
os.environ["MCP_RESOURCE_URL"] = "https://mcp.test/mcp"
os.environ["MCP_INTROSPECTION_SECRET"] = "introspection-secret-for-tests-only"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import User  # noqa: E402


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
def api(admin):
    test_client = TestClient(app)
    test_client.headers["Authorization"] = f"Bearer {create_access_token(admin)}"
    return test_client
