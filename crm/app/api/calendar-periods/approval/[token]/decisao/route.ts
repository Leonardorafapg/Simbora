import { NextRequest } from "next/server";
import { backendFetchPublic, proxyJson } from "@/services/server/backendClient";

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await request.json().catch(() => null);

  const res = await backendFetchPublic(`/calendar-periods/approval/${token}/decisao`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  return proxyJson(res, "Não foi possível registrar a decisão");
}
