export type AgendaParticipant = {
  id: number;
  full_name: string;
  photo_url: string | null;
};

export type AgendaEvent = {
  id: number;
  title: string;
  description: string | null;
  /** ISO 8601 com fuso (UTC). */
  starts_at: string;
  ends_at: string;
  created_by: number;
  /** Quem marcou — não aparece em `participants` (só se tiver se marcado). */
  created_by_name: string | null;
  participants: AgendaParticipant[];
};

export type AgendaEventInput = {
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  participant_ids: number[];
};
