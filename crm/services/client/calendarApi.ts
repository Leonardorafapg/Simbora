import type { CalendarEntry, CalendarEntryCreateInput, CalendarEntryUpdateInput } from "@/types/calendar";

async function parseErrorMessage(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return data.message ?? fallback;
}

export async function fetchCalendarEntries(params: { clientId?: number; month?: string; periodStatus?: string; assigneeId?: number }): Promise<CalendarEntry[]> {
  const query = new URLSearchParams();
  if (params.clientId) query.set("client_id", String(params.clientId));
  if (params.month) query.set("month", params.month);
  if (params.periodStatus) query.set("period_status", params.periodStatus);
  if (params.assigneeId) query.set("assignee_id", String(params.assigneeId));

  const res = await fetch(`/api/calendar?${query.toString()}`);
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível carregar o calendário."));
  return res.json();
}

export async function createCalendarEntry(
  input: CalendarEntryCreateInput,
  options?: { fromProduction?: boolean },
): Promise<CalendarEntry> {
  const res = await fetch(`/api/calendar${options?.fromProduction ? "?from_production=true" : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível criar a entrada."));
  return res.json();
}

export async function updateCalendarEntry(id: number, input: CalendarEntryUpdateInput): Promise<CalendarEntry> {
  const res = await fetch(`/api/calendar/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível salvar as alterações."));
  return res.json();
}

export async function deleteCalendarEntry(id: number): Promise<void> {
  const res = await fetch(`/api/calendar/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível remover a entrada."));
}
