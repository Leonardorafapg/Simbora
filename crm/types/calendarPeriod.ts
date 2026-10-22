export const CALENDAR_PERIOD_STATUSES = [
  "em_andamento",
  "enviado_aprovacao_amanda",
  "enviado_aprovacao_cliente",
  "finalizado",
  "reprovado",
] as const;
export type CalendarPeriodStatus = (typeof CALENDAR_PERIOD_STATUSES)[number];

export const CALENDAR_PERIOD_STATUS_LABELS: Record<CalendarPeriodStatus, string> = {
  em_andamento: "Em andamento",
  enviado_aprovacao_amanda: "Aguardando aprovação de Amanda",
  enviado_aprovacao_cliente: "Aguardando aprovação do cliente",
  finalizado: "Aprovado",
  reprovado: "Reprovado",
};

export const CALENDAR_PERIOD_STATUS_COLORS: Record<CalendarPeriodStatus, string> = {
  em_andamento: "bg-white/10 text-white/70",
  enviado_aprovacao_amanda: "bg-amber-400/15 text-amber-400",
  enviado_aprovacao_cliente: "bg-sky-400/15 text-sky-400",
  finalizado: "bg-emerald-500/15 text-emerald-400",
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

/** Item da caixa de entrada central de aprovações (tela /aprovacoes). */
export type CalendarPeriodPending = {
  client_id: number;
  client_name: string;
  year: number;
  month: number;
  status: CalendarPeriodStatus;
  pdf_url: string | null;
  updated_at: string;
};
