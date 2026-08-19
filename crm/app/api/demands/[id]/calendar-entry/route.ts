import { backendFetch, proxyJson } from "@/services/server/backendClient";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const res = await backendFetch(`/demands/${id}/calendar-entry`);
  return proxyJson(res, "Falha ao buscar anexos da postagem");
}
