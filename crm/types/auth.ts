export type SessionUser = {
  sub: string;
  email: string;
  name: string;
  photo_url: string | null;
  cargo: string;
  is_admin: boolean;
  permissions: string[];
  exp: number;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

/** Resposta de POST /auth/login do backend. */
export type BackendLoginResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};
