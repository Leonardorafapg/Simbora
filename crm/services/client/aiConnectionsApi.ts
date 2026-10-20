import type { AiConnection } from "@/types/aiConnection";

async function parseErrorMessage(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return data.message ?? fallback;
}

export async function fetchAiConnections(): Promise<AiConnection[]> {
  const res = await fetch("/api/ai-connections");
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível carregar as conexões de IA."));
  return res.json();
}

export async function revokeAiConnection(id: number): Promise<void> {
  const res = await fetch(`/api/ai-connections/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível desconectar."));
}
