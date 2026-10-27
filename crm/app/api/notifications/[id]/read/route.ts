import { NextRequest } from "next/server";
import { backendFetch, proxyJson } from "@/services/server/backendClient";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await backendFetch(`/notifications/${id}/read`, { method: "POST" });
  return proxyJson(res, "Falha ao marcar aviso como lido");
}
