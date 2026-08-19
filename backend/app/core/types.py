# backend/app/core/types.py
import json

from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator


class JSONText(TypeDecorator):
    """
    JSON serializado manualmente como TEXT — funciona igual em SQLite e
    Postgres, sem depender do tipo nativo JSON/JSONB do banco.

    O tipo `JSON` do SQLAlchemy, no dialeto Postgres, espera uma coluna
    física `json`/`jsonb` de verdade e confia no driver (psycopg2) pra
    decodificar sozinho na leitura. Colunas adicionadas via ALTER TABLE
    manual (sem Alembic, ver core/database.py) foram criadas como TEXT —
    então o Postgres nunca decodifica, e o valor cru ("[]") vaza até o
    Pydantic, que rejeita por não ser uma lista de verdade. Esse tipo
    decodifica o JSON em Python sempre, então funciona com a coluna TEXT
    que já existe, sem precisar migrar nada de novo.
    """

    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return json.dumps(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, (list, dict)):
            # Já veio decodificado (ex.: coluna nativa json/jsonb) — não
            # tenta rodar json.loads em cima de algo que já não é string.
            return value
        return json.loads(value)
