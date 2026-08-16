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
};

export type TeamMemberCreateInput = {
  full_name: string;
  cpf: string;
  birth_date: string;
  email: string;
  password: string;
  cargo: string;
  is_admin: boolean;
};

export type TeamMemberUpdateInput = Partial<{
  full_name: string;
  cpf: string;
  birth_date: string;
  email: string;
  password: string;
  cargo: string;
  is_admin: boolean;
  is_active: boolean;
}>;
