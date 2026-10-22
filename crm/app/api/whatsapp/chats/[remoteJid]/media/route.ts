import { NextRequest, NextResponse } from "next/server";
import { backendFetchForm, proxyJson } from "@/services/server/backendClient";

/** Envio de arquivo (imagem, vídeo, documento) numa conversa — repassa o multipart ao backend. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ remoteJid: string }> }) {
  const { remoteJid } = await params;
  const form = await request.formData().catch(() => null);
  if (!form?.get("file")) {
    return NextResponse.json({ message: "Escolha um arquivo para enviar." }, { status: 400 });
  }

  const res = await backendFetchForm(`/whatsapp/chats/${encodeURIComponent(remoteJid)}/media`, form);
  return proxyJson(res, "Falha ao enviar o arquivo");
}
