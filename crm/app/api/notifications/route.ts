import { NextRequest } from "next/server";
import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function GET(request: NextRequest) {
  const res = await backendFetch(`/notifications${request.nextUrl.search}`);
  return proxyJson(res, "Falha ao buscar avisos");
}
