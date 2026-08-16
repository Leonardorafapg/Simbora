# backend/app/scripts/seed.py
"""
Cria o primeiro usuario admin, se ainda nao existir nenhum.

Uso:
    python -m app.scripts.seed
"""
import getpass
import os
import re
from datetime import date

from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models.user import User


def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing_admin = db.query(User).filter(User.is_admin.is_(True)).first()
        if existing_admin is not None:
            print(f"Ja existe um usuario admin: {existing_admin.email}")
            return

        name = os.environ.get("SEED_ADMIN_NAME") or input("Nome completo do admin: ").strip()
        cpf_raw = os.environ.get("SEED_ADMIN_CPF") or input("CPF do admin (somente números): ").strip()
        birth_date_raw = os.environ.get("SEED_ADMIN_BIRTH_DATE") or input("Data de nascimento (AAAA-MM-DD): ").strip()
        email = os.environ.get("SEED_ADMIN_EMAIL") or input("Email do admin: ").strip()
        cargo = os.environ.get("SEED_ADMIN_CARGO") or input("Cargo do admin: ").strip()
        password = os.environ.get("SEED_ADMIN_PASSWORD") or getpass.getpass("Senha do admin: ")

        cpf = re.sub(r"\D", "", cpf_raw)

        if not name or not email or not password or len(cpf) != 11 or not birth_date_raw or not cargo:
            print("Nome, CPF (11 dígitos), data de nascimento, cargo, email e senha sao obrigatorios. Abortando.")
            return

        admin_user = User(
            full_name=name,
            cpf=cpf,
            birth_date=date.fromisoformat(birth_date_raw),
            email=email,
            password_hash=hash_password(password),
            cargo=cargo,
            is_admin=True,
            is_active=True,
        )
        db.add(admin_user)
        db.commit()
        print(f"Usuario admin criado: {email}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
