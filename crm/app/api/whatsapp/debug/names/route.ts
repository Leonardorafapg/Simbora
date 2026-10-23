import { backendFetch, proxyJson } from "@/services/server/backendClient";

/** Diagnóstico de nomes de grupo/duplicadas (admin) — abra /api/whatsapp/debug/names logado. */
export async function GET() {
  const res = await backendFetch("/whatsapp/debug/names", {}, 60_000);
  return proxyJson(res, "Falha no diagnóstico");
}
