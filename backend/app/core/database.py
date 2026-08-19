# backend/app/core/database.py
from sqlalchemy import create_engine, event, inspect
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
    tabelas que já existiam precisam de ALTER manual, feito abaixo.

    Roda tanto em SQLite (dev local) quanto em Postgres (produção/Railway):
    a versão anterior só cobria SQLite, então qualquer coluna adicionada a
    uma tabela já existente ficava faltando em produção sem ninguém notar
    até uma query esbarrar nela — foi exatamente o que aconteceu com
    `calendar_entries.material_files`/`final_image`.
    """
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)

    def add_column_if_missing(conn, table: str, column: str, ddl: str):
        if not inspector.has_table(table):
            return

        columns = {col["name"] for col in inspector.get_columns(table)}
        if column not in columns:
            conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {ddl}")
            conn.commit()

    with engine.connect() as conn:
        add_column_if_missing(conn, "users", "permissions", "permissions TEXT DEFAULT '[]'")
        add_column_if_missing(conn, "calendar_entries", "reference_image", "reference_image TEXT")
        add_column_if_missing(conn, "calendar_entries", "material_notes", "material_notes TEXT")
        add_column_if_missing(conn, "calendar_entries", "material_files", "material_files TEXT DEFAULT '[]'")
        add_column_if_missing(conn, "calendar_entries", "final_image", "final_image TEXT")
        add_column_if_missing(conn, "demands", "checklist", "checklist TEXT DEFAULT '[]'")
        # FALSE (não 0): literal válido tanto em Postgres quanto em SQLite
        # moderno — 0 quebra o ALTER em Postgres (BOOLEAN não aceita
        # inteiro como default sem cast explícito).
        add_column_if_missing(conn, "demands", "has_material", "has_material BOOLEAN DEFAULT FALSE")
        add_column_if_missing(conn, "whatsapp_messages", "media_type", "media_type VARCHAR(20)")
        add_column_if_missing(conn, "whatsapp_messages", "media_mimetype", "media_mimetype VARCHAR(100)")
        add_column_if_missing(conn, "clients", "photo_url", "photo_url VARCHAR(500)")
