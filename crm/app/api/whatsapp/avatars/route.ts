import { NextRequest } from "next/server";
import { backendFetch, proxyJson } from "@/services/server/backendClient";

/** Fotos de perfil de quem manda mensagem nos grupos: {jid: link ou null}. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  // A Evolution pode precisar perguntar algumas fotos uma a uma: dá um pouco mais de tempo.
  const res = await backendFetch("/whatsapp/avatars", { method: "POST", body: JSON.stringify(body) }, 30_000);
  return proxyJson(res, "Falha ao buscar fotos");
}
