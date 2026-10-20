import { backendFetchPublic, proxyJson } from "@/services/server/backendClient";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const res = await backendFetchPublic(`/calendar-periods/approval/${token}`, { method: "GET" });
  return proxyJson(res, "Link inválido ou expirado");
}
