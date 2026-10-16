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
  { key: "client.view", label: "Ver clientes" },
  { key: "client.create", label: "Criar clientes" },
  { key: "client.edit", label: "Editar clientes" },
  { key: "client.delete", label: "Remover clientes" },
  { key: "calendar.view", label: "Ver calendário" },
  { key: "calendar.create", label: "Criar entradas no calendário" },
  { key: "calendar.edit", label: "Editar entradas no calendário" },
  { key: "calendar.delete", label: "Remover entradas no calendário" },
  { key: "whatsapp.view", label: "Ver WhatsApp" },
  { key: "whatsapp.send", label: "Enviar mensagens no WhatsApp" },
];

/** Espelha app/core/permissions.py::has_permission — só pra UX, autorização real é sempre no backend. */
export function hasPermission(
  user: { is_admin: boolean; permissions: string[] } | null | undefined,
  key: string,
): boolean {
  if (!user) return false;
  if (user.is_admin) return true;
  return user.permissions.includes(key);
}
