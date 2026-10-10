import { NextRequest, NextResponse } from "next/server";
import { backendFetch, extractErrorMessage } from "@/services/server/backendClient";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Context) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (typeof body?.password !== "string" || body.password.length === 0) {
    return NextResponse.json({ message: "Informe a nova senha." }, { status: 400 });
  }

  const res = await backendFetch(`/users/${id}/password`, {
    method: "PUT",
    body: JSON.stringify({ password: body.password }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    return NextResponse.json(
      { message: extractErrorMessage(data, "Falha ao alterar a senha") },
      { status: res.status },
    );
  }

  return new NextResponse(null, { status: 204 });
}
