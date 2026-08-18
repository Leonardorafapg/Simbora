import { jwtVerify } from "jose";
import type { SessionUser } from "@/types/auth";

export const AUTH_COOKIE = "simbora_crm_token";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET não configurado");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Confere o formato do payload, não só a assinatura. Sem isso, um token
 * emitido antes de uma mudança no formato do JWT (ex: quando `role`/`level`
 * viraram `cargo`/`is_admin`) passaria a verificação e degradaria
 * permissões silenciosamente em vez de forçar um novo login.
 */
function isSessionUser(payload: unknown): payload is SessionUser {
  const p = payload as Partial<SessionUser> | null;
  const checks = {
    sub: typeof p?.sub === "string",
    email: typeof p?.email === "string",
    name: typeof p?.name === "string",
    cargo: typeof p?.cargo === "string",
    is_admin: typeof p?.is_admin === "boolean",
    permissions: Array.isArray(p?.permissions),
  };

  const ok = !!p && Object.values(checks).every(Boolean);
  if (!ok) {
    const missing = Object.entries(checks)
      .filter(([, valid]) => !valid)
      .map(([key]) => key);
    // eslint-disable-next-line no-console -- diagnóstico temporário de um bug de login em produção
    console.error("[session] payload do JWT não bate com SessionUser. Campos inválidos/ausentes:", missing);
  }
  return ok;
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return isSessionUser(payload) ? payload : null;
  } catch (err) {
    // eslint-disable-next-line no-console -- diagnóstico temporário de um bug de login em produção
    console.error("[session] verificação do JWT falhou:", err instanceof Error ? err.message : err);
    return null;
  }
}
