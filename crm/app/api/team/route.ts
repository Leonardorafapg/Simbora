import { NextRequest } from "next/server";
import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function GET() {
  const res = await backendFetch("/users");
  return proxyJson(res, "Falha ao buscar a equipe");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const res = await backendFetch("/users", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return proxyJson(res, "Falha ao cadastrar membro", 201);
}
