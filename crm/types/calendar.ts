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
  /** URL (Cloudinary) da imagem de referência. Só é exibida no drawer — nunca em relatório/impressão/PDF. */
  reference_image: string | null;
  /** URLs (Cloudinary) do material bruto que o social sobe pro designer usar na arte. */
  material_files: string[];
  /** URL (Cloudinary) da arte final, entregue pelo designer via o drawer da demanda vinculada. */
  final_image: string | null;
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
  material_files?: string[];
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
  material_files: string[];
  caption: string;
  material_notes: string | null;
}>;

/** O que o designer entrega via o drawer da demanda — nunca o resto do planejamento. */
export type DeliverableInput = Partial<{
  final_image: string | null;
  caption: string | null;
}>;
