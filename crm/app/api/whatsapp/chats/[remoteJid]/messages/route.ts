import { NextRequest } from "next/server";
import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ remoteJid: string }> }) {
  const { remoteJid } = await params;
  const res = await backendFetch(`/whatsapp/chats/${encodeURIComponent(remoteJid)}/messages`);
  return proxyJson(res, "Falha ao buscar mensagens");
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ remoteJid: string }> }) {
  const { remoteJid } = await params;
  const body = await request.json().catch(() => null);

  const res = await backendFetch(`/whatsapp/chats/${encodeURIComponent(remoteJid)}/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  return proxyJson(res, "Falha ao enviar mensagem");
}
