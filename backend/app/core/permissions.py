# backend/app/core/permissions.py
"""
Catálogo central de permissões granulares do sistema.

Admin (`User.is_admin`) sempre tem acesso total — não precisa constar na
lista `User.permissions`. As chaves abaixo só importam para usuários
não-admin, a quem o admin concede acesso pontual a cada recurso.
"""
from app.models.user import User

PERMISSIONS: dict[str, str] = {
    "team.view": "Ver equipe",
    "team.create": "Criar membros",
    "team.edit": "Editar membros",
    "team.delete": "Remover membros",
}


def has_permission(user: User, key: str) -> bool:
    if user.is_admin:
        return True
    return key in (user.permissions or [])
