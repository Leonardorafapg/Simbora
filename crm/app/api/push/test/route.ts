import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function POST() {
  const res = await backendFetch("/push/test", { method: "POST" });
  return proxyJson(res, "Falha ao enviar o teste");
}
