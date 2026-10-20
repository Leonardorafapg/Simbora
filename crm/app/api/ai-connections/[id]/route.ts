import { NextRequest, NextResponse } from "next/server";
import { backendFetch, extractErrorMessage } from "@/services/server/backendClient";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: Context) {
  const { id } = await params;

  const res = await backendFetch(`/oauth/grants/${id}`, { method: "DELETE" });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    return NextResponse.json(
      { message: extractErrorMessage(data, "Falha ao desconectar") },
      { status: res.status },
    );
  }

  return new NextResponse(null, { status: 204 });
}
