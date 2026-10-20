export const CALENDAR_PERIOD_STATUSES = [
  "em_andamento",
  "enviado_aprovacao_amanda",
  "aprovado_amanda",
  "enviado_aprovacao_cliente",
  "finalizado",
  "reprovado",
] as const;
export type CalendarPeriodStatus = (typeof CALENDAR_PERIOD_STATUSES)[number];

export const CALENDAR_PERIOD_STATUS_LABELS: Record<CalendarPeriodStatus, string> = {
  em_andamento: "Em andamento",
  enviado_aprovacao_amanda: "Aguardando aprovação da Amanda",
  aprovado_amanda: "Aprovado pela Amanda",
  enviado_aprovacao_cliente: "Aguardando aprovação do cliente",
  finalizado: "Aprovado",
  reprovado: "Reprovado",
};

export const CALENDAR_PERIOD_STATUS_COLORS: Record<CalendarPeriodStatus, string> = {
  em_andamento: "bg-white/10 text-white/70",
  enviado_aprovacao_amanda: "bg-amber-400/15 text-amber-400",
  aprovado_amanda: "bg-amber-400/15 text-amber-400",
  enviado_aprovacao_cliente: "bg-amber-400/15 text-amber-400",
  finalizado: "bg-cyan/15 text-cyan",
  reprovado: "bg-red-400/15 text-red-400",
};

export type CalendarPeriod = {
  client_id: number;
  year: number;
  month: number;
  status: CalendarPeriodStatus;
};

export type CalendarApprovalPublic = {
  client_id: number;
  client_name: string;
  year: number;
  month: number;
  status: CalendarPeriodStatus;
  pdf_url: string | null;
};
