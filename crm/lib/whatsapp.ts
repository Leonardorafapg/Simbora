import type { WhatsAppMessage } from "@/types/whatsapp";

const MEDIA_PREVIEW: Record<string, string> = {
  image: "📷 Foto",
  video: "🎥 Vídeo",
  audio: "🎤 Áudio",
  document: "📄 Documento",
  sticker: "Figurinha",
};

/** Texto da prévia na lista: a legenda, ou um rótulo quando é mídia sem legenda. */
export function previewOf(message: Pick<WhatsAppMessage, "text" | "media_type">): string | null {
  if (message.text) {
    return message.media_type === "image" || message.media_type === "video"
      ? `${MEDIA_PREVIEW[message.media_type].split(" ")[0]} ${message.text}`
      : message.text;
  }
  return message.media_type ? (MEDIA_PREVIEW[message.media_type] ?? null) : null;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Aceita epoch em segundos (mensagens), epoch em string ou ISO (lista de conversas). */
export function toDate(value: number | string | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" || /^\d+$/.test(value)) {
    const n = Number(value);
    return new Date(n < 1e12 ? n * 1000 : n);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Hora do dia (14:32) — dentro do balão. */
export function formatClock(value: number | string | null | undefined): string {
  const date = toDate(value);
  return date ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
}

/** Lista de conversas: hora se for hoje, "Ontem", dia da semana na última semana, senão dd/mm/aa. */
export function formatChatTime(value: number | string | null | undefined, now: Date = new Date()): string {
  const date = toDate(value);
  if (!date) return "";
  if (sameDay(date, now)) return formatClock(value);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return "Ontem";
  const days = (now.getTime() - date.getTime()) / 86_400_000;
  if (days < 7) return date.toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", "");
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/** "Hoje" / "Ontem" / "23 de agosto de 2026" — separador de dia dentro da conversa. */
export function formatDayLabel(date: Date, now: Date = new Date()): string {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, now)) return "Hoje";
  if (sameDay(date, yesterday)) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** Adiciona ou ignora a mensagem se o id já está na lista (HTTP e WebSocket entregam a mesma). */
export function upsertMessage(list: WhatsAppMessage[], message: WhatsAppMessage): WhatsAppMessage[] {
  if (message.id && list.some((m) => m.id === message.id)) return list;
  return [...list, message];
}

export type MessageRow =
  | { type: "day"; key: string; label: string }
  | { type: "message"; key: string; message: WhatsAppMessage; first: boolean; last: boolean };

/**
 * Linhas da conversa: separador por dia + mensagens agrupadas (mesmo remetente em
 * sequência, até 5 min entre elas). `first`/`last` controlam espaçamento e o nome em grupo.
 */
export function buildRows(messages: WhatsAppMessage[], now: Date = new Date()): MessageRow[] {
  const rows: MessageRow[] = [];
  let lastDay: string | null = null;
  let prev: WhatsAppMessage | null = null;

  messages.forEach((message, index) => {
    const date = toDate(message.timestamp);
    const dayKey = date ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : null;
    if (date && dayKey && dayKey !== lastDay) {
      rows.push({ type: "day", key: `day-${dayKey}`, label: formatDayLabel(date, now) });
      lastDay = dayKey;
      prev = null;
    }
    const sameGroup =
      prev !== null &&
      prev.from_me === message.from_me &&
      (prev.sender_name ?? null) === (message.sender_name ?? null) &&
      Math.abs((message.timestamp ?? 0) - (prev.timestamp ?? 0)) <= 300;
    const previousRow = rows[rows.length - 1];
    if (sameGroup && previousRow?.type === "message") previousRow.last = false;
    rows.push({ type: "message", key: message.id ?? `idx-${index}`, message, first: !sameGroup, last: true });
    prev = message;
  });

  return rows;
}

const SENDER_COLORS = ["#e0457b", "#2e8b57", "#1e88e5", "#d97706", "#8e44ad", "#00897b", "#c0392b", "#5c6bc0"];

/** Cor estável por remetente, pra distinguir quem fala num grupo. */
export function senderColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return SENDER_COLORS[hash % SENDER_COLORS.length];
}
