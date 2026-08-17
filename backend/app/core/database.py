# backend/app/core/database.py
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import settings

IS_SQLITE = settings.DATABASE_URL.startswith("sqlite")

connect_args = {"check_same_thread": False} if IS_SQLITE else {}
engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


if IS_SQLITE:
    # SQLite ignora chaves estrangeiras por padrao, o que permitiria gravar
    # um usuario apontando para um cargo inexistente.
    @event.listens_for(Engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_light_migrations():
    """
    Projeto não usa Alembic ainda. Para colunas novas em bancos sqlite já
    existentes, `Base.metadata.create_all` não altera tabelas já criadas —
    então cobrimos isso aqui manualmente, sempre de forma idempotente.
    """
    if not IS_SQLITE:
        return

    with engine.connect() as conn:
        tables = conn.exec_driver_sql(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
        ).fetchall()
        if not tables:
            return

        columns = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(users)")}
        if "permissions" not in columns:
            conn.exec_driver_sql("ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '[]'")
            conn.commit()
