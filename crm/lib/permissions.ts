/** Único controle de acesso do sistema por enquanto: admin gerencia a equipe. */
export function canManageTeam(isAdmin: boolean | undefined | null): boolean {
  return !!isAdmin;
}
