import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function GET() {
  const res = await backendFetch("/whatsapp/status");
  return proxyJson(res, "Falha ao verificar status do WhatsApp");
}
