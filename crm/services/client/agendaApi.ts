import type { AgendaEvent, AgendaEventInput } from "@/types/agenda";

async function parseErrorMessage(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return data.message ?? fallback;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function fetchAgendaEvents(start: string, end: string): Promise<AgendaEvent[]> {
  const res = await fetch(`/api/agenda/events?${new URLSearchParams({ start, end })}`);
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível carregar a agenda."));
  return res.json();
}

export async function fetchAgendaEvent(id: number): Promise<AgendaEvent> {
  const res = await fetch(`/api/agenda/events/${id}`);
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Compromisso não encontrado."));
  return res.json();
}

export async function createAgendaEvent(input: AgendaEventInput): Promise<AgendaEvent> {
  const res = await fetch("/api/agenda/events", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(input) });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível criar o compromisso."));
  return res.json();
}

export async function updateAgendaEvent(id: number, input: Partial<AgendaEventInput>): Promise<AgendaEvent> {
  const res = await fetch(`/api/agenda/events/${id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(input) });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível salvar o compromisso."));
  return res.json();
}

export async function deleteAgendaEvent(id: number): Promise<void> {
  const res = await fetch(`/api/agenda/events/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível cancelar o compromisso."));
}
