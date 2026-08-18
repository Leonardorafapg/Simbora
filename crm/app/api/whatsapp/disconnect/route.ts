import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function POST() {
  const res = await backendFetch("/whatsapp/disconnect", { method: "POST" });
  return proxyJson(res, "Falha ao desconectar o WhatsApp");
}
