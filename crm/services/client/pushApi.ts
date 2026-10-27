async function parseErrorMessage(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return data.message ?? fallback;
}

export type PushServerStatus = { enabled: boolean; public_key: string | null; devices: number };

export async function fetchPushStatus(): Promise<PushServerStatus> {
  const res = await fetch("/api/push/status");
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível ver o estado das notificações."));
  return res.json();
}

export async function subscribePush(subscription: PushSubscriptionJSON): Promise<void> {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível ativar as notificações."));
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  const res = await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível desativar as notificações."));
}

export async function sendPushTest(): Promise<void> {
  const res = await fetch("/api/push/test", { method: "POST" });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível enviar o teste."));
}
