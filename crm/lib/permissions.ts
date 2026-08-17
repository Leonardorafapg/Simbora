/** Único controle de acesso do sistema por enquanto: admin gerencia a equipe. */
export function canManageTeam(isAdmin: boolean | undefined | null): boolean {
  return !!isAdmin;
}

/**
 * Espelha backend/app/core/permissions.py — mesmas chaves, mesmos rótulos.
 * Admin tem tudo liberado sem precisar constar em `permissions`; a lista só
 * importa para conceder acesso pontual a um usuário não-admin. A checagem
 * real de autorização é sempre no backend — isso aqui é só pra render da UI.
 */
export const PERMISSIONS: { key: string; label: string }[] = [
  { key: "team.view", label: "Ver equipe" },
  { key: "team.create", label: "Criar membros" },
  { key: "team.edit", label: "Editar membros" },
  { key: "team.delete", label: "Remover membros" },
];
