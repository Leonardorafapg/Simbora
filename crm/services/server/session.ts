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
  return (
    !!p &&
    typeof p.sub === "string" &&
    typeof p.email === "string" &&
    typeof p.name === "string" &&
    typeof p.cargo === "string" &&
    typeof p.is_admin === "boolean"
  );
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return isSessionUser(payload) ? payload : null;
  } catch {
    return null;
  }
}
