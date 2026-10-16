import type { CalendarEntry, CalendarEntryStatus } from "@/types/calendar";
import { todayLocalISO } from "@/lib/format";

/**
 * Regra de prazo: todo post da semana (segunda a domingo) deve ser entregue
 * até a quinta-feira da semana anterior. "Entregue" = já passou da produção:
 * em aprovação, reprovada (modificações) ou aprovada/publicada (finalizados).
 */
export const DELIVERED_STATUSES: readonly CalendarEntryStatus[] = ["checagem_aprovacao", "modificacoes", "finalizados"];

const MS_DAY = 86_400_000;

function parseISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISO(date: Date) {
  return todayLocalISO(date);
}

function diffDays(fromISO: string, toISOStr: string) {
  return Math.round((parseISO(toISOStr).getTime() - parseISO(fromISO).getTime()) / MS_DAY);
}

/** Quinta-feira da semana anterior à semana (seg-dom) da data da postagem. */
export function deadlineFor(scheduledDate: string): string {
  const date = parseISO(scheduledDate);
  const mondayOffset = (date.getDay() + 6) % 7; // segunda = 0
  const deadline = new Date(date.getFullYear(), date.getMonth(), date.getDate() - mondayOffset - 4);
  return toISO(deadline);
}

export type DeadlineState =
  | "entregue_no_prazo"
  | "entregue_atrasado"
  | "atrasado"
  | "vence_hoje"
  | "vence_amanha"
  | "no_prazo";

export type DeadlineInfo = {
  deadline: string;
  state: DeadlineState;
  /** Dias de atraso (atrasado ou entregue_atrasado); 0 caso contrário. */
  daysLate: number;
};

/** `delivered_at` vem do backend em UTC sem sufixo de fuso — converte pra data local. */
function localDateOf(timestamp: string) {
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(timestamp) ? timestamp : `${timestamp}Z`;
  return toISO(new Date(iso));
}

export function deadlineInfo(entry: CalendarEntry, today: string = todayLocalISO()): DeadlineInfo {
  const deadline = deadlineFor(entry.scheduled_date);
  const delivered = DELIVERED_STATUSES.includes(entry.status);

  if (delivered) {
    const deliveredOn = entry.delivered_at ? localDateOf(entry.delivered_at) : null;
    const late = deliveredOn !== null && deliveredOn > deadline;
    return {
      deadline,
      state: late ? "entregue_atrasado" : "entregue_no_prazo",
      daysLate: late && deliveredOn ? diffDays(deadline, deliveredOn) : 0,
    };
  }

  const remaining = diffDays(today, deadline);
  if (remaining < 0) return { deadline, state: "atrasado", daysLate: -remaining };
  if (remaining === 0) return { deadline, state: "vence_hoje", daysLate: 0 };
  if (remaining === 1) return { deadline, state: "vence_amanha", daysLate: 0 };
  return { deadline, state: "no_prazo", daysLate: 0 };
}

export const DEADLINE_LABELS: Record<DeadlineState, string> = {
  entregue_no_prazo: "Entregue no prazo",
  entregue_atrasado: "Entregue com atraso",
  atrasado: "Atrasado",
  vence_hoje: "Vence hoje",
  vence_amanha: "Vence amanhã",
  no_prazo: "No prazo",
};

export const DEADLINE_CLASSES: Record<DeadlineState, string> = {
  entregue_no_prazo: "bg-emerald-500/15 text-emerald-400",
  entregue_atrasado: "bg-amber-400/15 text-amber-400",
  atrasado: "bg-danger/15 text-danger",
  vence_hoje: "bg-amber-400/15 text-amber-400",
  vence_amanha: "bg-amber-400/10 text-amber-300",
  no_prazo: "bg-white/10 text-white/60",
};

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "qui 23/10" */
export function formatDeadline(iso: string) {
  const [, month, day] = iso.split("-");
  return `${WEEKDAYS[parseISO(iso).getDay()]} ${day}/${month}`;
}

/** Urgência pra ordenar colunas: atrasados primeiro, depois quem vence antes. */
export function urgencyRank(info: DeadlineInfo): number {
  switch (info.state) {
    case "atrasado":
      return 0;
    case "vence_hoje":
      return 1;
    case "vence_amanha":
      return 2;
    case "no_prazo":
      return 3;
    default:
      return 4;
  }
}
