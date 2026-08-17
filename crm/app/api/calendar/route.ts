import { NextRequest } from "next/server";
import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  const res = await backendFetch(`/calendar-entries${query ? `?${query}` : ""}`);
  return proxyJson(res, "Falha ao buscar o calendário");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const res = await backendFetch("/calendar-entries", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return proxyJson(res, "Falha ao criar entrada", 201);
}
