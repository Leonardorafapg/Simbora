import { NextRequest, NextResponse } from "next/server";
import { backendFetch, extractErrorMessage, proxyJson } from "@/services/server/backendClient";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  const { id } = await params;
  const res = await backendFetch(`/agenda/events/${id}`);
  return proxyJson(res, "Falha ao buscar compromisso");
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const res = await backendFetch(`/agenda/events/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  return proxyJson(res, "Falha ao salvar compromisso");
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const { id } = await params;
  const res = await backendFetch(`/agenda/events/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    return NextResponse.json(
      { message: extractErrorMessage(data, "Falha ao cancelar compromisso") },
      { status: res.status },
    );
  }
  return new NextResponse(null, { status: 204 });
}
