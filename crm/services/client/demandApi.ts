import type { Demand, DemandCreateInput, DemandFilters, DemandUpdateInput } from "@/types/demand";
import type { CalendarEntry, DeliverableInput } from "@/types/calendar";

async function parseErrorMessage(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return data.message ?? fallback;
}

export async function fetchDemands(filters: DemandFilters = {}): Promise<Demand[]> {
  const query = new URLSearchParams();
  if (filters.client_id) query.set("client_id", String(filters.client_id));
  if (filters.unassigned) {
    query.set("unassigned", "true");
  } else if (filters.assignee_id) {
    query.set("assignee_id", String(filters.assignee_id));
  }
  if (filters.status) query.set("status", filters.status);
  if (filters.date_from) query.set("date_from", filters.date_from);
  if (filters.date_to) query.set("date_to", filters.date_to);

  const res = await fetch(`/api/demands?${query.toString()}`);
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível carregar as demandas."));
  return res.json();
}

export async function createDemand(input: DemandCreateInput): Promise<Demand> {
  const res = await fetch("/api/demands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível criar a demanda."));
  return res.json();
}

export async function updateDemand(id: number, input: DemandUpdateInput): Promise<Demand> {
  const res = await fetch(`/api/demands/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível salvar as alterações."));
  return res.json();
}

export async function deleteDemand(id: number): Promise<void> {
  const res = await fetch(`/api/demands/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível remover a demanda."));
}

/** Anexos (referência + material) da postagem que originou essa demanda. */
export async function fetchDemandCalendarEntry(id: number): Promise<CalendarEntry> {
  const res = await fetch(`/api/demands/${id}/calendar-entry`);
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível carregar os anexos."));
  return res.json();
}

/** Arte final + legenda que o designer entrega. */
export async function updateDemandDeliverable(id: number, input: DeliverableInput): Promise<CalendarEntry> {
  const res = await fetch(`/api/demands/${id}/deliverable`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível salvar a entrega."));
  return res.json();
}
