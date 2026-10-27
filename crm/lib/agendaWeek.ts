// Sem imports de runtime de outros módulos: este arquivo também roda nos testes do Node, que não conhece o
// alias "@/" nem aceita import sem extensão (e o build do Next não aceita extensão ".ts").
import type { AgendaEvent } from "@/types/agenda";

const DAY_NAMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const pad = (n: number) => String(n).padStart(2, "0");

/** AAAA-MM-DD no fuso local. */
const dayKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Horários que sempre aparecem na grade (os de compromissos fora dessa lista entram além deles). */
export const DEFAULT_TIMES = Array.from({ length: 12 }, (_, i) => `${pad(8 + i)}:00`); // 08:00 … 19:00

export type WeekEvent = { id: number; title: string; detail: string };
export type WeekRow = { time: string; cells: WeekEvent[][] };
export type WeekDay = { key: string; label: string };
export type WeekGrid = {
  weekStart: string;
  weekEnd: string;
  /** "26/10 a 01/11" */
  rangeLabel: string;
  days: WeekDay[];
  rows: WeekRow[];
};

function parseISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Segunda-feira (AAAA-MM-DD) da semana que contém a data. */
export function weekStartOf(iso: string): string {
  const date = parseISO(iso);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return dayKey(date);
}

/** Soma dias a uma data AAAA-MM-DD. */
export function addDays(iso: string, days: number): string {
  const date = parseISO(iso);
  date.setDate(date.getDate() + days);
  return dayKey(date);
}

/** Janela [segunda 00:00, próxima segunda 00:00) em ISO UTC — o que se pede ao backend. */
export function weekWindow(weekStart: string): { start: string; end: string } {
  return { start: parseISO(weekStart).toISOString(), end: parseISO(addDays(weekStart, 7)).toISOString() };
}

const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function detailOf(event: AgendaEvent, start: Date, end: Date): string {
  const until = dayKey(start) === dayKey(end) ? `até ${clock(end)}` : `até ${shortDate(dayKey(end))} ${clock(end)}`;
  const others = event.participants.map((p) => p.full_name.split(" ")[0]);
  return others.length > 0 ? `${until} • ${others.join(", ")}` : until;
}

/**
 * Grade da semana no formato da agenda impressa: linhas por horário, colunas de segunda a domingo.
 * O compromisso aparece na linha do horário em que começa; nos dias seguintes (se atravessar dias), na 1ª linha.
 */
export function buildWeekGrid(events: AgendaEvent[], weekStart: string, defaultTimes: string[] = DEFAULT_TIMES): WeekGrid {
  const days: WeekDay[] = DAY_NAMES.map((name, i) => {
    const key = addDays(weekStart, i);
    return { key, label: `${name} ${key.slice(8, 10)}` };
  });
  const weekEnd = days[6].key;
  const dayIndex = new Map(days.map((d, i) => [d.key, i]));

  const visible = events
    .filter((e) => {
      const start = new Date(e.starts_at);
      const end = new Date(new Date(e.ends_at).getTime() - 1);
      return dayKey(start) <= weekEnd && dayKey(end) >= weekStart;
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id - b.id);

  // Horários da grade: os padrão + os em que algum compromisso da semana começa.
  const times = new Set(defaultTimes);
  for (const e of visible) {
    const start = new Date(e.starts_at);
    if (dayIndex.has(dayKey(start))) times.add(clock(start));
  }
  const sorted = [...times].sort();
  const rows: WeekRow[] = sorted.map((time) => ({ time, cells: days.map(() => []) }));
  const rowOf = new Map(rows.map((r) => [r.time, r]));

  for (const e of visible) {
    const start = new Date(e.starts_at);
    const end = new Date(e.ends_at);
    const last = new Date(end.getTime() - 1);
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cursor <= last) {
      const col = dayIndex.get(dayKey(cursor));
      if (col !== undefined) {
        const startsToday = dayKey(cursor) === dayKey(start);
        const row = startsToday ? (rowOf.get(clock(start)) as WeekRow) : rows[0];
        // Dias seguintes de um compromisso longo: deixa claro que é continuação (e quando termina).
        const detail = startsToday
          ? detailOf(e, start, end)
          : dayKey(cursor) === dayKey(last)
            ? `continuação • até ${clock(end)}`
            : "continuação • o dia todo";
        row.cells[col].push({ id: e.id, title: e.title, detail });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return { weekStart, weekEnd, rangeLabel: `${shortDate(weekStart)} a ${shortDate(weekEnd)}`, days, rows };
}
