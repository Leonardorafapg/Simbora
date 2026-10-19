import type { InsightsRange, InstagramPostStatus } from "@/types/instagram";

// Horários do Instagram são sempre lidos e mostrados no horário de Brasília,
// não no fuso do navegador — quem agenda de outro fuso não erra em 1h/3h.
const BRT_ZONE = "America/Sao_Paulo";
const BRT_OFFSET = "-03:00"; // Brasil sem horário de verão desde 2019

function brtParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRT_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** ISO (UTC) -> "AAAA-MM-DDTHH:mm" em Brasília, pro <input type="datetime-local">. */
export function isoToBrtInput(iso: string): string {
  const p = brtParts(new Date(iso));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** "AAAA-MM-DDTHH:mm" (Brasília) -> ISO com fuso explícito. */
export function brtInputToIso(value: string): string {
  return `${value}:00${BRT_OFFSET}`;
}

/** Agora + `minutes`, no formato do input (Brasília). */
export function brtInputFromNow(minutes = 60): string {
  return isoToBrtInput(new Date(Date.now() + minutes * 60_000).toISOString());
}

export function formatBrt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const p = brtParts(new Date(iso));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

export function isVideoUrl(url: string): boolean {
  try {
    return /\.(mp4|mov)$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export const POST_STATUS_LABELS: Record<InstagramPostStatus, string> = {
  pendente: "Agendado",
  publicando: "Publicando...",
  publicado: "Publicado",
  erro: "Erro",
};

export const POST_STATUS_CLASSES: Record<InstagramPostStatus, string> = {
  pendente: "bg-white/10 text-white/70",
  publicando: "bg-cyan/15 text-cyan",
  publicado: "bg-emerald-500/15 text-emerald-300",
  erro: "bg-danger/15 text-danger",
};

export const CAPTION_MAX = 2200;

export function countHashtags(text: string): number {
  return text.split(/\s+/).filter((w) => w.startsWith("#") && w.length > 1).length;
}

// --- Métricas ----------------------------------------------------------------------

export const METRIC_LABELS: Record<string, string> = {
  views: "Visualizações",
  reach: "Alcance",
  accounts_engaged: "Contas engajadas",
  total_interactions: "Interações",
  likes: "Curtidas",
  comments: "Comentários",
  saved: "Salvamentos",
  saves: "Salvamentos",
  shares: "Compartilhamentos",
  replies: "Respostas",
  profile_links_taps: "Cliques em links do perfil",
  ig_reels_avg_watch_time: "Tempo médio assistido",
};

export function formatMetric(key: string, value: number): string {
  if (key === "ig_reels_avg_watch_time") return `${(value / 1000).toFixed(1)}s`;
  return value.toLocaleString("pt-BR");
}

export type InsightsPeriod = "24h" | "7" | "30" | "last-month" | "90" | "365" | "custom";

export const PERIOD_LABELS: Record<InsightsPeriod, string> = {
  "24h": "Últimas 24h",
  "7": "Últimos 7 dias",
  "30": "Últimos 30 dias",
  "last-month": "Mês passado",
  "90": "Últimos 90 dias",
  "365": "Últimos 12 meses",
  custom: "Personalizado",
};

/** Hoje em Brasília, AAAA-MM-DD. */
function todayBrt(): Date {
  const p = brtParts(new Date());
  return new Date(Number(p.year), Number(p.month) - 1, Number(p.day));
}

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** `null` = últimas 24h; `undefined` = personalizado ainda incompleto/inválido. */
export function rangeFor(period: InsightsPeriod, customSince: string, customUntil: string): InsightsRange | undefined {
  const today = todayBrt();
  const daysAgo = (n: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);
  switch (period) {
    case "24h":
      return null;
    case "7":
    case "30":
    case "90":
    case "365":
      return { since: isoDate(daysAgo(Number(period) - 1)), until: isoDate(today) };
    case "last-month":
      return {
        since: isoDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        until: isoDate(new Date(today.getFullYear(), today.getMonth(), 0)),
      };
    case "custom":
      return customSince && customUntil && customSince <= customUntil && customUntil <= isoDate(today)
        ? { since: customSince, until: customUntil }
        : undefined;
  }
}
