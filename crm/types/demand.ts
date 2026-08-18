export const DEMAND_STATUSES = ["pendente", "em_andamento", "em_aprovacao", "reprovada", "concluida"] as const;
export type DemandStatus = (typeof DEMAND_STATUSES)[number];

export const DEMAND_STATUS_LABELS: Record<DemandStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  em_aprovacao: "Em aprovação",
  reprovada: "Reprovada",
  concluida: "Concluída",
};

export const DEMAND_STATUS_COLORS: Record<DemandStatus, string> = {
  pendente: "bg-white/10 text-white/70",
  em_andamento: "bg-amber-400/15 text-amber-400",
  em_aprovacao: "bg-purple-400/15 text-purple-400",
  reprovada: "bg-red-400/15 text-red-400",
  concluida: "bg-emerald-400/15 text-emerald-400",
};

export type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

export type Demand = {
  id: number;
  client_id: number | null;
  calendar_entry_id: number | null;
  title: string;
  notes: string | null;
  requester_id: number;
  assignee_id: number | null;
  is_art: boolean;
  status: DemandStatus;
  due_date: string | null;
  /** "Já tem material?" — já existe imagem/vídeo pronto, ou precisa captar do zero. */
  has_material: boolean;
  checklist: ChecklistItem[];
};

export type DemandCreateInput = {
  client_id?: number | null;
  title: string;
  notes?: string;
  assignee_id?: number | null;
  is_art?: boolean;
  status?: DemandStatus;
  due_date?: string | null;
  has_material?: boolean;
  checklist?: ChecklistItem[];
};

export type DemandUpdateInput = Partial<{
  client_id: number | null;
  title: string;
  notes: string;
  assignee_id: number | null;
  status: DemandStatus;
  due_date: string | null;
  has_material: boolean;
  checklist: ChecklistItem[];
}>;

export type DemandFilters = Partial<{
  client_id: number;
  assignee_id: number;
  /** Mutuamente exclusivo com `assignee_id` — "sem responsável". */
  unassigned: boolean;
  status: DemandStatus;
  date_from: string;
  date_to: string;
}>;

/** Atrasada = tem prazo, já passou, e ainda não foi concluída. */
export function isDemandOverdue(demand: Demand): boolean {
  if (!demand.due_date || demand.status === "concluida") return false;
  return demand.due_date < new Date().toISOString().slice(0, 10);
}

export type SituacaoGeral = "Atrasada" | "No prazo" | "Concluída" | "Sem prazo";

export const SITUACAO_COLORS: Record<SituacaoGeral, string> = {
  Atrasada: "bg-red-400/15 text-red-400 border border-red-400/30",
  "No prazo": "bg-cyan/15 text-cyan border border-cyan/30",
  Concluída: "bg-emerald-400/15 text-emerald-400 border border-emerald-400/30",
  "Sem prazo": "bg-white/10 text-white/50 border border-white/10",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Diferença legível entre agora e o prazo (ex: "21h 46min"). */
function formatDuration(ms: number) {
  const totalMin = Math.round(Math.abs(ms) / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${pad(m)}min`;
}

/** Situação em tempo real da demanda — sem completed_at, "concluída" não distingue se foi no prazo. */
export function getDemandSituacao(demand: Demand, now = new Date()): { specific: string; general: SituacaoGeral } {
  if (demand.status === "concluida") {
    return { specific: "Concluída", general: "Concluída" };
  }
  if (!demand.due_date) {
    return { specific: "Sem prazo definido", general: "Sem prazo" };
  }

  const due = new Date(`${demand.due_date}T23:59:59`);
  const diff = due.getTime() - now.getTime();

  return diff >= 0
    ? { specific: `Dentro do prazo por ${formatDuration(diff)}`, general: "No prazo" }
    : { specific: `Atrasada há ${formatDuration(diff)}`, general: "Atrasada" };
}

export function checklistProgress(demand: Demand): { done: number; total: number } {
  return { done: demand.checklist.filter((item) => item.done).length, total: demand.checklist.length };
}
