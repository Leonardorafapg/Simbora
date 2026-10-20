import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function GET() {
  const res = await backendFetch("/oauth/grants");
  return proxyJson(res, "Falha ao buscar conexões de IA");
}
