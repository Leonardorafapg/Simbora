import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function POST() {
  const res = await backendFetch("/whatsapp/connect", { method: "POST" });
  return proxyJson(res, "Falha ao conectar ao WhatsApp");
}
