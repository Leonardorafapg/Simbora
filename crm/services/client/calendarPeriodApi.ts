import type {
  CalendarPeriod,
  CalendarPeriodPending,
  CalendarPeriodStatus,
} from "@/types/calendarPeriod";

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

/** Time marca o mês como pronto — sobe pro status "aguardando aprovação da Amanda". */
export async function enviarParaAprovacao(clientId: number, year: number, month: number): Promise<CalendarPeriod> {
  const res = await fetch("/api/calendar-periods/enviar-aprovacao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, year, month }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível enviar para aprovação."));
  return res.json();
}

/** Decisão da Amanda — aprovando, as postagens do mês entram na Produção e os designers são avisados. */
export async function decidirComoAmanda(
  clientId: number,
  year: number,
  month: number,
  decision: "aprovado" | "reprovado",
  reason?: string,
): Promise<CalendarPeriod> {
  const res = await fetch("/api/calendar-periods/decisao-amanda", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, year, month, decision, reason }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível registrar a decisão."));
  return res.json();
}

/** Caixa de entrada central — todo período aguardando a aprovação da Amanda. */
export async function fetchPendingApprovals(): Promise<CalendarPeriodPending[]> {
  const res = await fetch("/api/calendar-periods/pending-approval");
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível carregar as aprovações pendentes."));
  return res.json();
}
