import { NextRequest } from "next/server";
import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const res = await backendFetch("/calendar-periods/decisao-amanda", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return proxyJson(res, "Falha ao registrar a decisão");
}
