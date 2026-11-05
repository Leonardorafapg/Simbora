import type { WhatsAppMessage } from "@/types/whatsapp";

/** Quem aparece no topo da citação dentro do balão: "Você", o autor ou, sem saber, o nome da conversa. */
export function quoteAuthor(message: Pick<WhatsAppMessage, "reply_from_me" | "reply_author">, fallback: string): string {
  if (message.reply_from_me) return "Você";
  return message.reply_author?.trim() || fallback;
}

/** O que a barra "respondendo a..." mostra da mensagem escolhida (montado por `replyTargetOf`, em lib/whatsapp.ts). */
export type ReplyTarget = { id: string; author: string; text: string };

/** Insere `insert` no lugar da seleção (ou no cursor) e devolve o novo texto e onde o cursor fica. */
export function insertAtCursor(text: string, start: number, end: number, insert: string): { text: string; cursor: number } {
  const from = Math.max(0, Math.min(start, text.length));
  const to = Math.max(from, Math.min(end, text.length));
  return { text: text.slice(0, from) + insert + text.slice(to), cursor: from + insert.length };
}
