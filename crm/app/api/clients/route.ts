import { NextRequest } from "next/server";
import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function GET() {
  const res = await backendFetch("/clients");
  return proxyJson(res, "Falha ao buscar clientes");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const res = await backendFetch("/clients", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return proxyJson(res, "Falha ao cadastrar cliente", 201);
}
