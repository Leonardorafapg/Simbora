export type TeamMember = {
  id: number;
  full_name: string;
  cpf: string;
  birth_date: string;
  email: string;
  photo_url: string | null;
  cargo: string;
  is_admin: boolean;
  is_active: boolean;
  permissions: string[];
};

export type TeamMemberCreateInput = {
  full_name: string;
  cpf: string;
  birth_date: string;
  email: string;
  password: string;
  photo_url?: string | null;
  cargo: string;
  is_admin: boolean;
  permissions?: string[];
};

/**
 * Diretório enxuto — qualquer usuário autenticado pode ler (sem CPF, email ou
 * permissões), diferente de TeamMember que vem de /users (admin only).
 * Usado pra atribuir/filtrar demandas (requester/assignee).
 */
export type TeamDirectoryEntry = {
  id: number;
  full_name: string;
  cargo: string;
  is_active: boolean;
};

export type TeamMemberUpdateInput = Partial<{
  full_name: string;
  cpf: string;
  birth_date: string;
  email: string;
  password: string;
  photo_url: string | null;
  cargo: string;
  is_admin: boolean;
  is_active: boolean;
  permissions: string[];
}>;
