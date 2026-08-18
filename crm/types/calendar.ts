export const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
] as const;

export type CalendarEntry = {
  id: number;
  client_id: number;
  scheduled_date: string;
  theme: string;
  execution_notes: string | null;
  reference_link: string | null;
  /** Data URI (base64) da imagem de referência. Só é exibida no drawer — nunca em relatório/impressão/PDF. */
  reference_image: string | null;
  caption: string | null;
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
  caption?: string;
  material_notes?: string | null;
};

export type CalendarEntryUpdateInput = Partial<{
  client_id: number;
  scheduled_date: string;
  theme: string;
  execution_notes: string;
  reference_link: string;
  reference_image: string | null;
  caption: string;
  material_notes: string | null;
}>;
