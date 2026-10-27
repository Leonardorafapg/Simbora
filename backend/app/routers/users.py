# backend/app/routers/users.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.permissions import PERMISSIONS
from app.core.security import hash_password
from app.models.user import User
from app.services import agenda, oauth
from app.schemas.user import (
    PasswordChange,
    PermissionCatalogEntry,
    UserCreate,
    UserDirectoryEntry,
    UserOut,
    UserUpdate,
)

router = APIRouter()


@router.get("/permissions", response_model=list[PermissionCatalogEntry])
async def list_permissions(_: User = Depends(require_admin)):
    return [{"key": key, "label": label} for key, label in PERMISSIONS.items()]


@router.get("/users/directory", response_model=list[UserDirectoryEntry])
async def users_directory(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Diretório enxuto da equipe pra quem precisa só resolver "quem é o
    fulano" (atribuir postagem, filtrar por responsável) sem ser admin.
    """
    return db.query(User).order_by(User.full_name).all()


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return db.query(User).order_by(User.full_name).all()


@router.post("/users", response_model=UserOut, status_code=201)
async def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = User(
        full_name=payload.full_name,
        cpf=payload.cpf,
        birth_date=payload.birth_date,
        email=payload.email,
        password_hash=hash_password(payload.password),
        cargo=payload.cargo,
        is_admin=payload.is_admin,
        photo_url=payload.photo_url,
        permissions=payload.permissions,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email ou CPF já cadastrado")
    db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")

    data = payload.model_dump(exclude_unset=True)

    # Impede que o admin logado tire o próprio acesso de admin ou se desative.
    if user.id == current_user.id:
        if data.get("is_admin") is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Não é possível remover seu próprio acesso de administrador",
            )
        if data.get("is_active") is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Não é possível desativar seu próprio usuário",
            )

    password = data.pop("password", None)
    if password:
        user.password_hash = hash_password(password)

    for field, value in data.items():
        setattr(user, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email ou CPF já cadastrado")
    if password or data.get("is_active") is False:
        oauth.revoke_all_for_user(db, user.id)
    db.refresh(user)
    return user


@router.put("/users/{user_id}/password", status_code=204)
async def change_user_password(
    user_id: int,
    payload: PasswordChange,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Troca a senha de um membro. Só administradores — a senha nova nunca é devolvida."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")

    user.password_hash = hash_password(payload.password)
    db.commit()
    oauth.revoke_all_for_user(db, user.id)


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível excluir seu próprio usuário",
        )

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")

    oauth.delete_user_oauth_data(db, user.id)
    agenda.delete_user_data(db, user.id)
    db.delete(user)
    db.commit()
