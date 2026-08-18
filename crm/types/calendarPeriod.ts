export const CALENDAR_PERIOD_STATUSES = ["em_andamento", "finalizado", "reprovado"] as const;
export type CalendarPeriodStatus = (typeof CALENDAR_PERIOD_STATUSES)[number];

export const CALENDAR_PERIOD_STATUS_LABELS: Record<CalendarPeriodStatus, string> = {
  em_andamento: "Em andamento",
  finalizado: "Finalizado",
  reprovado: "Reprovado",
};

export const CALENDAR_PERIOD_STATUS_COLORS: Record<CalendarPeriodStatus, string> = {
  em_andamento: "bg-white/10 text-white/70",
  finalizado: "bg-cyan/15 text-cyan",
  reprovado: "bg-red-400/15 text-red-400",
};

export type CalendarPeriod = {
  client_id: number;
  year: number;
  month: number;
  status: CalendarPeriodStatus;
};
