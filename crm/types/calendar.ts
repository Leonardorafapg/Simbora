export const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
] as const;

export const CALENDAR_ENTRY_STATUSES = ["nao_iniciado", "feito", "aprovado", "reprovado", "concluido"] as const;
export type CalendarEntryStatus = (typeof CALENDAR_ENTRY_STATUSES)[number];
export const CALENDAR_ENTRY_STATUS_LABELS: Record<CalendarEntryStatus, string> = {
  nao_iniciado: "Não iniciado",
  feito: "Feito",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  concluido: "Concluído",
};

export type CalendarEntry = {
  id: number;
  client_id: number;
  scheduled_date: string;
  theme: string;
  execution_notes: string | null;
  reference_link: string | null;
  /** URL (R2) da imagem de referência. Só é exibida no drawer — nunca em relatório/impressão/PDF. */
  reference_image: string | null;
  /** URLs (R2) do material bruto que o social sobe pro designer usar na arte. */
  material_files: string[];
  /** URL (R2) da arte final, entregue pelo designer pelo drawer da postagem. */
  final_image: string | null;
  caption: string | null;
  status: CalendarEntryStatus;
  /** Markdown livre "já tem material?" — sem UI própria ainda, reservado pra uso futuro. */
  material_notes: string | null;
  created_by: number;
};

export type CalendarEntryCreateInput = {
  client_id: number;
  scheduled_date: string;
  theme: string;
  execution_notes: string;
  reference_link?: string;
  reference_image?: string | null;
  material_files?: string[];
  final_image?: string | null;
  caption?: string;
  material_notes?: string | null;
  status?: CalendarEntryStatus;
};

export type CalendarEntryUpdateInput = Partial<{
  client_id: number;
  scheduled_date: string;
  theme: string;
  execution_notes: string;
  reference_link: string;
  reference_image: string | null;
  material_files: string[];
  final_image: string | null;
  caption: string;
  material_notes: string | null;
  status: CalendarEntryStatus;
}>;
