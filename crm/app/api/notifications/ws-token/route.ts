import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/services/server/session";

/** Mesmo motivo do ws-token do WhatsApp: o WebSocket vai direto ao backend e o JWT está num cookie httpOnly. */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: "Não autenticado" }, { status: 401 });

  const backendUrl = process.env.BACKEND_URL || "";
  return NextResponse.json({ token, wsUrl: `${backendUrl.replace(/^http/, "ws")}/api/v1/notifications/ws` });
}
