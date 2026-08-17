export const CALENDAR_FORMATS = ["Reels", "Carrossel", "Post estático", "Story", "Vídeo"] as const;
export type CalendarFormat = (typeof CALENDAR_FORMATS)[number];

export const CALENDAR_STATUSES = ["planejado", "aguardando_legenda", "agendado", "publicado"] as const;
export type CalendarStatus = (typeof CALENDAR_STATUSES)[number];

export const CALENDAR_STATUS_LABELS: Record<CalendarStatus, string> = {
  planejado: "Planejado",
  aguardando_legenda: "Aguardando legenda",
  agendado: "Agendado",
  publicado: "Publicado",
};

export type CalendarEntry = {
  id: number;
  client_id: number;
  scheduled_date: string;
  theme: string;
  format: CalendarFormat;
  execution_notes: string | null;
  reference_link: string | null;
  caption: string | null;
  status: CalendarStatus;
  created_by: number;
};

export type CalendarEntryCreateInput = {
  client_id: number;
  scheduled_date: string;
  theme: string;
  format: CalendarFormat;
  execution_notes?: string;
  reference_link?: string;
  caption?: string;
  status?: CalendarStatus;
};

export type CalendarEntryUpdateInput = Partial<{
  client_id: number;
  scheduled_date: string;
  theme: string;
  format: CalendarFormat;
  execution_notes: string;
  reference_link: string;
  caption: string;
  status: CalendarStatus;
}>;
