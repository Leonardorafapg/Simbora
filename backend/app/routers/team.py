# backend/app/routers/team.py
"""
Gestão de equipe delegável por permissão (usada pela automação/MCP).

Diferença pro `routers/users.py` (que é só admin):
- aqui o acesso é por permissão granular (`team.view/create/edit`), então dá
  pra delegar sem tornar a conta admin;
- NUNCA lida com senha: o membro nasce com uma senha aleatória que ninguém
  conhece e só passa a conseguir entrar quando um admin define a senha pelo
  painel (`PUT /users/{id}/password`);
- NUNCA mexe em `is_admin`.

Travas contra escalada de privilégio:
- só concede permissões que o próprio chamador tem;
- não edita administradores, nem a si mesmo, nem quem tem permissões que o
  chamador não tem (seria tomar o controle de alguém mais privilegiado).
"""
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.core.permissions import PERMISSIONS, has_permission
from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import PermissionCatalogEntry, TeamMemberCreate, TeamMemberUpdate, UserOut

router = APIRouter()


def _missing_permissions(caller: User, permissions: list[str]) -> list[str]:
    return [key for key in permissions if not has_permission(caller, key)]


def _ensure_can_grant(caller: User, permissions: list[str]) -> None:
    missing = _missing_permissions(caller, permissions)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Você não pode conceder permissões que não tem: {', '.join(missing)}",
        )


def _ensure_can_manage(caller: User, target: User) -> None:
    if target.id == caller.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Você não pode editar a própria conta por aqui")
    if target.is_admin and not caller.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Administradores só podem ser editados por administradores"
        )
    if _missing_permissions(caller, target.permissions or []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esse usuário tem permissões que você não tem — peça a um administrador",
        )


@router.get("/team/permissions", response_model=list[PermissionCatalogEntry])
async def list_team_permissions(_: User = Depends(require_permission("team.view"))):
    return [{"key": key, "label": label} for key, label in PERMISSIONS.items()]


@router.get("/team/members", response_model=list[UserOut])
async def list_team_members(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("team.view")),
):
    return db.query(User).order_by(User.full_name).all()


@router.post("/team/members", response_model=UserOut, status_code=201)
async def create_team_member(
    payload: TeamMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("team.create")),
):
    _ensure_can_grant(current_user, payload.permissions)

    user = User(
        full_name=payload.full_name,
        cpf=payload.cpf,
        birth_date=payload.birth_date,
        email=payload.email,
        # Senha aleatória descartada: a conta só entra depois que um admin
        # definir a senha pelo painel.
        password_hash=hash_password(secrets.token_urlsafe(48)),
        cargo=payload.cargo,
        photo_url=payload.photo_url,
        is_admin=False,
        is_active=True,
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


@router.patch("/team/members/{user_id}", response_model=UserOut)
async def update_team_member(
    user_id: int,
    payload: TeamMemberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("team.edit")),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")

    _ensure_can_manage(current_user, user)

    data = payload.model_dump(exclude_unset=True)
    if "permissions" in data:
        _ensure_can_grant(current_user, data["permissions"])

    for field, value in data.items():
        setattr(user, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email ou CPF já cadastrado")
    db.refresh(user)
    return user
