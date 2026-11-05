import type { CalendarEntryStatus } from "@/types/calendar";

/** Permissão da redatora. Espelha backend/app/services/post_review.py. */
export const REVIEW_PERMISSION = "post.review";

/** Coluna que a redatora decide: dela o post sai aprovado ou com pedido de ajustes. */
export const REVIEW_STAGE: CalendarEntryStatus = "checagem_aprovacao";

const APPROVED: CalendarEntryStatus[] = ["finalizados", "publicados"];

/**
 * Essa mudança de coluna é uma decisão de revisão (aprovar ou pedir ajustes)?
 * Só pra UX: o backend é quem barra de verdade.
 */
export function needsReviewer(current: CalendarEntryStatus, target: CalendarEntryStatus): boolean {
  if (APPROVED.includes(target)) return !APPROVED.includes(current);
  if (target === "modificacoes") return current !== "modificacoes";
  return false;
}

/** Saiu da checagem por aprovação ou por pedido de ajustes — o motivo é obrigatório quando são ajustes. */
export function isReviewDecision(current: CalendarEntryStatus, target: CalendarEntryStatus): boolean {
  return current === REVIEW_STAGE && (APPROVED.includes(target) || target === "modificacoes");
}

export const REVIEWER_ONLY_MESSAGE =
  'Só quem revisa os posts (redatora) pode aprovar ou pedir ajustes. Mande o post para "Checagem e aprovação" e aguarde a revisão.';
