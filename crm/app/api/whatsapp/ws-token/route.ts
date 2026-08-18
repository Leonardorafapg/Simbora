import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/services/server/session";

/**
 * O WebSocket do WhatsApp conecta direto no backend (não dá pra proxiar um
 * WS por uma Route Handler comum) — mas o JWT vive num cookie httpOnly, que
 * o JS do browser não consegue ler. Essa rota expõe o token pro cliente
 * buscar sob demanda, só na hora de abrir o socket, sem deixá-lo acessível
 * o tempo todo (o cookie httpOnly continua sendo o que autentica o resto).
 */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }

  const backendUrl = process.env.BACKEND_URL || "";
  const wsUrl = `${backendUrl.replace(/^http/, "ws")}/api/v1/whatsapp/ws`;

  return NextResponse.json({ token, wsUrl });
}
