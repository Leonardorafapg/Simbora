import type { CalendarApprovalPublic, CalendarPeriod, CalendarPeriodStatus } from "@/types/calendarPeriod";

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
export async function enviarParaAprovacao(
  clientId: number,
  year: number,
  month: number,
  pdfUrl: string,
): Promise<CalendarPeriod> {
  const res = await fetch("/api/calendar-periods/enviar-aprovacao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, year, month, pdf_url: pdfUrl }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível enviar para aprovação."));
  return res.json();
}

/** Decisão da Amanda — aprovando, dispara o envio automático do PDF pro WhatsApp do cliente. */
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

/** Rota pública (sem login) consultada pela página /aprovacao/[token]. */
export async function fetchApprovalByToken(token: string): Promise<CalendarApprovalPublic> {
  const res = await fetch(`/api/calendar-periods/approval/${token}`);
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Link inválido ou expirado."));
  return res.json();
}

/** Decisão do cliente pelo link público — sem login. */
export async function decidirComoCliente(
  token: string,
  decision: "aprovado" | "reprovado",
  reason?: string,
): Promise<CalendarApprovalPublic> {
  const res = await fetch(`/api/calendar-periods/approval/${token}/decisao`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, reason }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível registrar a decisão."));
  return res.json();
}
