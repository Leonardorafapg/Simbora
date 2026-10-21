import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function GET() {
  const res = await backendFetch("/calendar-periods/pending-approval");
  return proxyJson(res, "Falha ao buscar as aprovações pendentes");
}
