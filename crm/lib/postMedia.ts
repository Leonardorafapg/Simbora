export type PostType = "feed" | "carousel" | "video";

export type PostMedia = { post_type: PostType; final_image: string | null; final_images: string[] };

/** Troca o tipo do post mantendo as artes coerentes (espelha `normalize_post_media` do backend). */
export function switchPostType(prev: PostMedia, type: PostType, stash: string[] = []): PostMedia {
  if (prev.post_type === type) return prev;
  if (type === "carousel") {
    // Voltou pro carrossel sem trocar a capa: recupera os slides de antes.
    const restored = stash.length > 1 && stash[0] === prev.final_image ? stash : null;
    const slides = restored ?? (prev.final_image ? [prev.final_image] : []);
    return { post_type: type, final_image: slides[0] ?? null, final_images: slides };
  }
  return { post_type: type, final_image: prev.final_images[0] ?? prev.final_image, final_images: [] };
}

/** Slides do carrossel: a capa (`final_image`) é sempre o 1º. */
export function withSlides(urls: string[]): Pick<PostMedia, "final_image" | "final_images"> {
  return { final_images: urls, final_image: urls[0] ?? null };
}

/** Remove o item da posição `index` (por posição, não por URL, pra tolerar repetidos). */
export function removeAt<T>(list: T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}
