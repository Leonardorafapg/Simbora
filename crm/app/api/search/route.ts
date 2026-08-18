import { NextRequest } from "next/server";
import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const res = await backendFetch(`/search?q=${encodeURIComponent(q)}`);
  return proxyJson(res, "Falha ao buscar");
}
