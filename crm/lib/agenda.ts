import type { AgendaEvent } from "@/types/agenda";

const pad = (n: number) => String(n).padStart(2, "0");

/** AAAA-MM-DD no fuso local. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** ISO (UTC) -> valor do <input type="datetime-local"> no fuso local. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Valor do <input type="datetime-local"> (fuso local) -> ISO em UTC pra API. */
export function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

/** Janela [início, fim) do mês pedido ao backend — `month` de 1 a 12. */
export function monthWindow(year: number, month: number): { start: string; end: string } {
  return {
    start: new Date(year, month - 1, 1).toISOString(),
    end: new Date(year, month, 1).toISOString(),
  };
}

/** O compromisso toca o mês `month` (1-12)? Usado pra não jogar na tela um evento de outro mês. */
export function overlapsMonth(event: Pick<AgendaEvent, "starts_at" | "ends_at">, year: number, month: number): boolean {
  const { start, end } = monthWindow(year, month);
  return event.starts_at < end && event.ends_at > start;
}

/** Compromissos por dia (AAAA-MM-DD). Compromisso que atravessa dias aparece em cada um, em ordem de início. */
export function eventsByDay(events: AgendaEvent[]): Map<string, AgendaEvent[]> {
  const byDay = new Map<string, AgendaEvent[]>();
  const sorted = [...events].sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id - b.id);
  for (const event of sorted) {
    const start = new Date(event.starts_at);
    const end = new Date(event.ends_at);
    // O fim exato à meia-noite pertence ao dia anterior (reunião 22h–00h não "vaza" pro dia seguinte).
    const last = new Date(end.getTime() - 1);
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cursor <= last) {
      const key = dayKey(cursor);
      byDay.set(key, [...(byDay.get(key) ?? []), event]);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return byDay;
}

/** Células da grade do mês (domingo primeiro): número do dia ou null nas pontas. */
export function monthCells(year: number, month: number): (number | null)[] {
  const lead = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const short = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

/** "14:00 – 15:00", ou "28/10 14:00 – 29/10 10:00" quando atravessa dias. */
export function formatEventRange(event: Pick<AgendaEvent, "starts_at" | "ends_at">): string {
  const start = new Date(event.starts_at);
  const end = new Date(event.ends_at);
  if (dayKey(start) === dayKey(end)) return `${clock(start)} – ${clock(end)}`;
  return `${short(start)} ${clock(start)} – ${short(end)} ${clock(end)}`;
}

/** Tempo desde um aviso: "agora", "há 5 min", "há 3 h", "ontem" ou a data. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24 && dayKey(date) === dayKey(now)) return `há ${hours} h`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) return "ontem";
  return `${short(date)}/${String(date.getFullYear()).slice(2)}`;
}
