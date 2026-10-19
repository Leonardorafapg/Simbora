import { NextRequest, NextResponse } from "next/server";
import { backendFetch, extractErrorMessage } from "@/services/server/backendClient";

type Context = { params: Promise<{ path: string[] }> };

// Repasse genérico pras rotas /instagram do backend. As rotas públicas do
// OAuth (callback, deauthorize, data-deletion) são chamadas pela Meta direto
// no backend e ficam de fora daqui.
const BLOCKED_PREFIX = "oauth/";
const ALLOWED_OAUTH = new Set(["oauth/connect-url"]);
const SEGMENT = /^[A-Za-z0-9_-]+$/;
// Agendar converte as imagens e as métricas consultam dezenas de posts na Meta.
const INSTAGRAM_TIMEOUT_MS = 120_000;

async function forward(request: NextRequest, { params }: Context, method: string) {
  const { path } = await params;
  if (!path.length || !path.every((segment) => SEGMENT.test(segment))) {
    return NextResponse.json({ message: "Rota inválida" }, { status: 404 });
  }
  const joined = path.join("/");
  if (joined.startsWith(BLOCKED_PREFIX) && !ALLOWED_OAUTH.has(joined)) {
    return NextResponse.json({ message: "Rota inválida" }, { status: 404 });
  }

  const query = request.nextUrl.searchParams.toString();
  const body = method === "POST" || method === "PATCH" ? JSON.stringify(await request.json().catch(() => ({}))) : undefined;
  const res = await backendFetch(`/instagram/${joined}${query ? `?${query}` : ""}`, { method, body }, INSTAGRAM_TIMEOUT_MS);

  if (res.status === 204) return new NextResponse(null, { status: 204 });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return NextResponse.json(
      { message: extractErrorMessage(data, "Falha na comunicação com o Instagram") },
      { status: res.status },
    );
  }
  return NextResponse.json(data, { status: res.status });
}

export function GET(request: NextRequest, context: Context) {
  return forward(request, context, "GET");
}

export function POST(request: NextRequest, context: Context) {
  return forward(request, context, "POST");
}

export function PATCH(request: NextRequest, context: Context) {
  return forward(request, context, "PATCH");
}

export function DELETE(request: NextRequest, context: Context) {
  return forward(request, context, "DELETE");
}
