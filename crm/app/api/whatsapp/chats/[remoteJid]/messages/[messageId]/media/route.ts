import { NextRequest, NextResponse } from "next/server";
import { backendFetch, extractErrorMessage } from "@/services/server/backendClient";

type Params = { remoteJid: string; messageId: string };

// Proxy binário (não dá pra usar `proxyJson`, que assume resposta JSON) —
// repassa o arquivo (imagem/vídeo/áudio/documento) já decodificado pelo
// backend, mantendo o Content-Type e o Content-Disposition de download.
export async function GET(request: NextRequest, { params }: { params: Promise<Params> }) {
  const { remoteJid, messageId } = await params;
  const download = request.nextUrl.searchParams.get("download");

  const query = download ? "?download=true" : "";
  const res = await backendFetch(
    `/whatsapp/chats/${encodeURIComponent(remoteJid)}/messages/${encodeURIComponent(messageId)}/media${query}`,
  );

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    return NextResponse.json({ message: extractErrorMessage(data, "Não foi possível carregar a mídia.") }, { status: res.status });
  }

  const headers = new Headers();
  const contentType = res.headers.get("content-type");
  const contentDisposition = res.headers.get("content-disposition");
  if (contentType) headers.set("Content-Type", contentType);
  if (contentDisposition) headers.set("Content-Disposition", contentDisposition);

  return new NextResponse(res.body, { status: 200, headers });
}
