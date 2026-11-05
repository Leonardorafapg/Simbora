import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function GET() {
  const res = await backendFetch("/clients/directory");
  return proxyJson(res, "Falha ao buscar clientes");
}
