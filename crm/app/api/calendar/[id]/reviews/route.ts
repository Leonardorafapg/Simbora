import { NextRequest } from "next/server";
import { backendFetch, proxyJson } from "@/services/server/backendClient";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  const { id } = await params;

  const res = await backendFetch(`/calendar-entries/${id}/reviews`);

  return proxyJson(res, "Falha ao carregar o histórico de revisões");
}
