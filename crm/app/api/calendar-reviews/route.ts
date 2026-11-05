import { NextRequest } from "next/server";
import { backendFetch, proxyJson } from "@/services/server/backendClient";

/** Histórico de revisões de vários posts de uma vez: ?entry_ids=1&entry_ids=2. */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  const res = await backendFetch(`/calendar-reviews${query ? `?${query}` : ""}`);
  return proxyJson(res, "Falha ao carregar o histórico de revisões");
}
