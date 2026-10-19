export const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
] as const;

/** Quadros do fluxo de produção, na ordem do kanban. */
export const CALENDAR_ENTRY_STATUSES = [
  "producao",
  "andamento",
  "modificacoes",
  "checagem_aprovacao",
  "finalizados",
  "publicados",
] as const;
export type CalendarEntryStatus = (typeof CALENDAR_ENTRY_STATUSES)[number];
export const CALENDAR_ENTRY_STATUS_LABELS: Record<CalendarEntryStatus, string> = {
  producao: "Produção",
  andamento: "Andamento",
  modificacoes: "Modificações",
  checagem_aprovacao: "Checagem e aprovação",
  // A chave interna continua "finalizados" (já gravada no banco); o rótulo é "Aprovados".
  finalizados: "Aprovados",
  publicados: "Publicados",
};

import type { Tag } from "@/types/tag";

export type CalendarEntry = {
  id: number;
  client_id: number;
  scheduled_date: string;
  /** Nome da publicação — opcional em postagens antigas (cai no theme). */
  title: string | null;
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
  /** Quem pediu a demanda (padrão: social do cliente). */
  requester_id: number | null;
  /** Quem executa (padrão: designer do cliente). */
  assignee_id: number | null;
  /** Etiquetas globais aplicadas à postagem. */
  tags: Tag[];
  /** 1ª vez que chegou a um status de entregue (UTC, sem sufixo); base do controle de prazo. */
  delivered_at: string | null;
  /** Markdown livre "já tem material?" — sem UI própria ainda, reservado pra uso futuro. */
  material_notes: string | null;
  created_by: number;
};

export type CalendarEntryCreateInput = {
  client_id: number;
  scheduled_date: string;
  title?: string | null;
  theme: string;
  execution_notes?: string;
  reference_link?: string;
  reference_image?: string | null;
  material_files?: string[];
  final_image?: string | null;
  caption?: string;
  material_notes?: string | null;
  status?: CalendarEntryStatus;
  requester_id?: number | null;
  assignee_id?: number | null;
  tag_ids?: number[];
};

export type CalendarEntryUpdateInput = Partial<{
  client_id: number;
  scheduled_date: string;
  title: string | null;
  theme: string;
  execution_notes: string;
  reference_link: string;
  reference_image: string | null;
  material_files: string[];
  final_image: string | null;
  caption: string;
  material_notes: string | null;
  status: CalendarEntryStatus;
  requester_id: number | null;
  assignee_id: number | null;
  tag_ids: number[];
}>;
