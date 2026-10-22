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
        add_column_if_missing(conn, "calendar_entries", "final_image_story", "final_image_story TEXT")
        add_column_if_missing(conn, "calendar_entries", "post_type", "post_type VARCHAR(20) DEFAULT 'feed' NOT NULL")
        add_column_if_missing(conn, "calendar_entries", "final_images", "final_images TEXT DEFAULT '[]'")
        add_column_if_missing(conn, "calendar_entries", "title", "title VARCHAR(200)")
        add_column_if_missing(conn, "calendar_entries", "requester_id", "requester_id INTEGER REFERENCES users(id)")
        add_column_if_missing(conn, "calendar_entries", "assignee_id", "assignee_id INTEGER REFERENCES users(id)")
        add_column_if_missing(conn, "calendar_entries", "custom_deadline", "custom_deadline DATE")
        add_column_if_missing(
            conn, "calendar_entries", "from_production", "from_production BOOLEAN NOT NULL DEFAULT FALSE"
        )
        if inspector.has_table("calendar_entries") and "delivered_at" not in {
            col["name"] for col in inspector.get_columns("calendar_entries")
        }:
            conn.exec_driver_sql("ALTER TABLE calendar_entries ADD COLUMN delivered_at TIMESTAMP")
            # Postagens que já estavam entregues: usa a última atualização como data de entrega.
            conn.exec_driver_sql(
                "UPDATE calendar_entries SET delivered_at = updated_at "
                "WHERE status IN ('checagem_aprovacao', 'modificacoes', 'finalizados')"
            )
            conn.commit()
        # Status antigos da postagem -> quadros novos (idempotente: depois da
        # primeira rodada não sobra linha com os valores antigos).
        if inspector.has_table("calendar_entries"):
            for old, new in (
                ("nao_iniciado", "producao"),
                ("feito", "checagem_aprovacao"),
                ("reprovado", "modificacoes"),
                ("aprovado", "finalizados"),
                ("concluido", "finalizados"),
            ):
                conn.exec_driver_sql(f"UPDATE calendar_entries SET status = '{new}' WHERE status = '{old}'")
            conn.commit()
        # Status intermediário "aprovado_amanda" saiu do fluxo: o cronograma já segue direto para o cliente.
        if inspector.has_table("calendar_periods"):
            conn.exec_driver_sql(
                "UPDATE calendar_periods SET status = 'enviado_aprovacao_cliente' WHERE status = 'aprovado_amanda'"
            )
            conn.commit()
        add_column_if_missing(conn, "whatsapp_messages", "media_type", "media_type VARCHAR(20)")
        add_column_if_missing(conn, "whatsapp_messages", "media_mimetype", "media_mimetype VARCHAR(100)")
        add_column_if_missing(conn, "whatsapp_messages", "media_filename", "media_filename VARCHAR(255)")
        add_column_if_missing(conn, "clients", "photo_url", "photo_url VARCHAR(500)")
        add_column_if_missing(conn, "calendar_periods", "pdf_url", "pdf_url VARCHAR(500)")
        if inspector.has_table("calendar_periods") and not IS_SQLITE:
            # Status novos da cadeia de aprovação ("enviado_aprovacao_amanda" etc.)
            # passam de 20 caracteres — a coluna antiga era VARCHAR(20) em produção.
            conn.exec_driver_sql("ALTER TABLE calendar_periods ALTER COLUMN status TYPE VARCHAR(30)")
            conn.commit()
