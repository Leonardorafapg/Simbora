import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/services/server/session";
import { backendFetchPublic } from "@/services/server/backendClient";
import type { BackendLoginResponse } from "@/types/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body?.email || !body?.password) {
    return NextResponse.json({ message: "Email e senha são obrigatórios" }, { status: 400 });
  }

  const res = await backendFetchPublic("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: body.email, password: body.password }),
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return NextResponse.json({ message: data?.detail ?? "Falha no login" }, { status: res.status });
  }

  const { access_token, expires_in } = data as BackendLoginResponse;

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: expires_in,
  });

  return response;
}
