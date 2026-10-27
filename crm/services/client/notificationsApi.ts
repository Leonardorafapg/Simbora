import type { AppNotification } from "@/types/notification";

async function parseErrorMessage(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return data.message ?? fallback;
}

export async function fetchNotifications(limit = 30): Promise<AppNotification[]> {
  const res = await fetch(`/api/notifications?limit=${limit}`);
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível carregar os avisos."));
  return res.json();
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await fetch("/api/notifications/unread-count");
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível contar os avisos."));
  return (await res.json()).unread;
}

export async function markNotificationRead(id: number): Promise<void> {
  const res = await fetch(`/api/notifications/${id}/read`, { method: "POST" });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível marcar como lido."));
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await fetch("/api/notifications/read-all", { method: "POST" });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível marcar como lidos."));
}
