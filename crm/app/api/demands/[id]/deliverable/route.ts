import { NextRequest } from "next/server";
import { backendFetch, proxyJson } from "@/services/server/backendClient";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  const res = await backendFetch(`/demands/${id}/deliverable`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

  return proxyJson(res, "Falha ao salvar a entrega");
}
