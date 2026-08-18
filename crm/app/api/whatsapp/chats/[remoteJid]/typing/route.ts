import { NextRequest } from "next/server";
import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function POST(request: NextRequest, { params }: { params: Promise<{ remoteJid: string }> }) {
  const { remoteJid } = await params;
  const body = await request.json().catch(() => null);

  const res = await backendFetch(`/whatsapp/chats/${encodeURIComponent(remoteJid)}/typing`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  return proxyJson(res, "Falha ao enviar indicador de digitando", 204);
}
