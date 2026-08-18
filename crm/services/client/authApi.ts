import { clearAll } from "@/lib/dataCache";
import type { LoginCredentials } from "@/types/auth";

export type LoginResult =
  | { ok: true }
  | { ok: false; message: string };

export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, message: data.message ?? "Não foi possível entrar." };
  }

  return { ok: true };
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
  clearAll();
}
