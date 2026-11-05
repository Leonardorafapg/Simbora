import { cache } from "react";
import { cookies } from "next/headers";
import { AUTH_COOKIE, verifySessionToken } from "@/services/server/session";
import { backendFetch } from "@/services/server/backendClient";
import type { SessionUser } from "@/types/auth";

type BackendMe = {
  full_name: string;
  email: string;
  photo_url: string | null;
  cargo: string;
  is_admin: boolean;
  permissions: string[];
};

/**
 * Sessão do usuário logado, para uso em Server Components e Route Handlers.
 * Não pode ser usado no proxy.ts — lá o cookie vem do NextRequest.
 *
 * O JWT só prova quem é o usuário: as permissões dentro dele são as do momento
 * do login e ficam velhas até o token expirar. Por isso os dados de acesso são
 * relidos do backend (`/auth/me`) a cada requisição; o JWT serve de fallback se
 * o backend estiver indisponível. `cache` evita repetir a chamada entre o
 * layout e a página da mesma requisição.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return null;

  const res = await backendFetch("/auth/me");
  // Usuário desativado ou removido: o token ainda assina, mas não vale mais.
  if (res.status === 401) return null;
  if (!res.ok) return session;

  const me = (await res.json().catch(() => null)) as BackendMe | null;
  if (!me || !Array.isArray(me.permissions)) return session;

  return {
    ...session,
    name: me.full_name,
    email: me.email,
    photo_url: me.photo_url,
    cargo: me.cargo,
    is_admin: me.is_admin,
    permissions: me.permissions,
  };
});
