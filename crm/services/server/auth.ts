import { cookies } from "next/headers";
import { AUTH_COOKIE, verifySessionToken } from "@/services/server/session";
import type { SessionUser } from "@/types/auth";

/**
 * Sessão do usuário logado, para uso em Server Components e Route Handlers.
 * Não pode ser usado no proxy.ts — lá o cookie vem do NextRequest.
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  return token ? verifySessionToken(token) : null;
}
