import { NextRequest } from "next/server";
import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function GET() {
  const res = await backendFetch("/tags");
  return proxyJson(res, "Falha ao buscar etiquetas");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const res = await backendFetch("/tags", { method: "POST", body: JSON.stringify(body) });

  return proxyJson(res, "Falha ao criar etiqueta", 201);
}
