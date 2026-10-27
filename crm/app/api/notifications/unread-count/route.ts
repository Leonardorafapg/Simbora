import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function GET() {
  const res = await backendFetch("/notifications/unread-count");
  return proxyJson(res, "Falha ao contar avisos");
}
