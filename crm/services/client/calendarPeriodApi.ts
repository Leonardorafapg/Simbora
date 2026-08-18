import type { CalendarPeriod, CalendarPeriodStatus } from "@/types/calendarPeriod";

async function parseErrorMessage(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return data.message ?? fallback;
}

export async function fetchCalendarPeriod(clientId: number, year: number, month: number): Promise<CalendarPeriod> {
  const query = new URLSearchParams({ client_id: String(clientId), year: String(year), month: String(month) });
  const res = await fetch(`/api/calendar-periods?${query.toString()}`);
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível carregar o status do cronograma."));
  return res.json();
}

export async function setCalendarPeriodStatus(
  clientId: number,
  year: number,
  month: number,
  status: CalendarPeriodStatus,
): Promise<CalendarPeriod> {
  const res = await fetch("/api/calendar-periods", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, year, month, status }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível atualizar o status do cronograma."));
  return res.json();
}
