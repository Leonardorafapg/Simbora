import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function POST() {
  const res = await backendFetch("/notifications/read-all", { method: "POST" });
  return proxyJson(res, "Falha ao marcar avisos como lidos");
}
