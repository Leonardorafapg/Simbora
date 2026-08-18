import { NextRequest } from "next/server";
import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const res = await backendFetch(`/calendar-periods?${searchParams.toString()}`);
  return proxyJson(res, "Falha ao buscar status do cronograma");
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const res = await backendFetch("/calendar-periods", {
    method: "PUT",
    body: JSON.stringify(body),
  });

  return proxyJson(res, "Falha ao atualizar status do cronograma");
}
