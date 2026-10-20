import { NextRequest } from "next/server";
import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const res = await backendFetch("/calendar-periods/enviar-aprovacao", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return proxyJson(res, "Falha ao enviar para aprovação");
}
