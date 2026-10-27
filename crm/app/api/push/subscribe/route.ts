import { NextRequest, NextResponse } from "next/server";
import { backendFetch, extractErrorMessage } from "@/services/server/backendClient";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const res = await backendFetch("/push/subscribe", {
    method: "POST",
    body: JSON.stringify(body),
    // O backend usa o user-agent pra identificar o aparelho na lista.
    headers: { "user-agent": request.headers.get("user-agent") ?? "" },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    return NextResponse.json({ message: extractErrorMessage(data, "Falha ao ativar as notificações") }, { status: res.status });
  }
  return new NextResponse(null, { status: 204 });
}
