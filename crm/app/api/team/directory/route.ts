import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function GET() {
  const res = await backendFetch("/users/directory");
  return proxyJson(res, "Falha ao buscar a equipe");
}
