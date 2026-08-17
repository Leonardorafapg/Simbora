import { NextRequest, NextResponse } from "next/server";
import { backendFetch, extractErrorMessage, proxyJson } from "@/services/server/backendClient";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  const res = await backendFetch(`/clients/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

  return proxyJson(res, "Falha ao salvar alterações");
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const { id } = await params;

  const res = await backendFetch(`/clients/${id}`, { method: "DELETE" });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    return NextResponse.json(
      { message: extractErrorMessage(data, "Falha ao remover cliente") },
      { status: res.status },
    );
  }

  return new NextResponse(null, { status: 204 });
}
