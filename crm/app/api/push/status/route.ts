import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function GET() {
  const res = await backendFetch("/push/status");
  return proxyJson(res, "Falha ao ver o estado das notificações");
}
