import type { CalendarEntry } from "@/types/calendar";

/** O que o designer entregou, na ordem de publicação (feed, carrossel ou links do vídeo). */
export type DeliveredArt = { images: string[]; story: string | null; links: string[] };

export function deliveredArt(entry: CalendarEntry): DeliveredArt {
  let images: string[] = [];
  if (entry.post_type === "carousel" && entry.final_images.length > 0) images = entry.final_images;
  else if (entry.final_image) images = [entry.final_image];
  return { images, story: entry.final_image_story, links: entry.final_links ?? [] };
}

export function hasFinalArt(entry: CalendarEntry): boolean {
  const art = deliveredArt(entry);
  return art.images.length > 0 || !!art.story || art.links.length > 0;
}

/** Abas da fila: por padrão todos; "Com arte" já tem a entrega do designer; "Aguardando mídia" ainda não tem. */
export type ReviewTab = "todos" | "com_arte" | "aguardando";

export function matchesTab(entry: CalendarEntry, tab: ReviewTab): boolean {
  if (tab === "todos") return true;
  return tab === "com_arte" ? hasFinalArt(entry) : !hasFinalArt(entry);
}

export function tabCounts(entries: CalendarEntry[]): Record<ReviewTab, number> {
  const withArt = entries.filter(hasFinalArt).length;
  return { todos: entries.length, com_arte: withArt, aguardando: entries.length - withArt };
}

/** Arquivos e links do briefing (referência e material), sem contar a arte final entregue. */
export function briefingAttachmentCount(entry: CalendarEntry): number {
  const legacyLink = entry.reference_link && entry.reference_links.length === 0 ? 1 : 0;
  return (
    (entry.reference_image ? 1 : 0) +
    entry.material_files.length +
    entry.reference_links.length +
    entry.material_links.length +
    legacyLink
  );
}

/** Sem diferenciar acentos nem maiúsculas. */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Busca por cliente, título/descrição e designer. Termo vazio aceita tudo. */
export function matchesSearch(
  entry: CalendarEntry,
  term: string,
  names: { client?: string | null; designer?: string | null },
): boolean {
  const wanted = normalizeText(term.trim());
  if (!wanted) return true;
  const haystack = normalizeText([entry.title ?? "", entry.theme, names.client ?? "", names.designer ?? ""].join(" "));
  return haystack.includes(wanted);
}

/** Quem espera há mais tempo primeiro; sem data de entrega, pela data do post. */
export function sortByWaiting(entries: CalendarEntry[]): CalendarEntry[] {
  return [...entries].sort(
    (a, b) =>
      (a.delivered_at ?? "9999").localeCompare(b.delivered_at ?? "9999") ||
      a.scheduled_date.localeCompare(b.scheduled_date),
  );
}
