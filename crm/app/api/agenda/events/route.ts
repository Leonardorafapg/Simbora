import { NextRequest } from "next/server";
import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function GET(request: NextRequest) {
  const res = await backendFetch(`/agenda/events${request.nextUrl.search}`);
  return proxyJson(res, "Falha ao buscar compromissos");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const res = await backendFetch("/agenda/events", { method: "POST", body: JSON.stringify(body) });
  return proxyJson(res, "Falha ao criar compromisso", 201);
}
