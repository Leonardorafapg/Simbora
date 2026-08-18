import { NextRequest } from "next/server";
import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const res = await backendFetch(`/demands?${searchParams.toString()}`);
  return proxyJson(res, "Falha ao buscar demandas");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const res = await backendFetch("/demands", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return proxyJson(res, "Falha ao criar demanda", 201);
}
