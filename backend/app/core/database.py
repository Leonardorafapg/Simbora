# backend/app/core/database.py
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import settings

# Railway (e antigos provedores estilo Heroku) expõem a URL como "postgres://",
# esquema que o SQLAlchemy 2.x não reconhece mais — precisa ser "postgresql://".
DATABASE_URL = settings.DATABASE_URL
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

IS_SQLITE = DATABASE_URL.startswith("sqlite")

connect_args = {"check_same_thread": False} if IS_SQLITE else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
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
    Projeto não usa Alembic ainda. `Base.metadata.create_all` cobre tabelas
    novas (idempotente, não toca nas existentes) — mas colunas novas em
    tabelas que já existiam num banco sqlite precisam de ALTER manual, feito
    abaixo.
    """
    Base.metadata.create_all(bind=engine)

    if not IS_SQLITE:
        return

    def add_column_if_missing(conn, table: str, column: str, ddl: str):
        tables = conn.exec_driver_sql(
            f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'"
        ).fetchall()
        if not tables:
            return

        columns = {row[1] for row in conn.exec_driver_sql(f"PRAGMA table_info({table})")}
        if column not in columns:
            conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {ddl}")
            conn.commit()

    with engine.connect() as conn:
        add_column_if_missing(conn, "users", "permissions", "permissions TEXT DEFAULT '[]'")
        add_column_if_missing(conn, "calendar_entries", "reference_image", "reference_image TEXT")
        add_column_if_missing(conn, "calendar_entries", "material_notes", "material_notes TEXT")
        add_column_if_missing(conn, "demands", "checklist", "checklist TEXT DEFAULT '[]'")
        add_column_if_missing(conn, "demands", "has_material", "has_material BOOLEAN DEFAULT 0")
