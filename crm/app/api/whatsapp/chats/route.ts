import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function GET() {
  const res = await backendFetch("/whatsapp/chats");
  return proxyJson(res, "Falha ao buscar conversas");
}
