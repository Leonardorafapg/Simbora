"use client";

import { useEffect, useState } from "react";
import { createTag, deleteTag, fetchTags, updateTag } from "@/services/client/tagApi";
import { getOrFetch, invalidate } from "@/lib/dataCache";
import { tagColorSortKey } from "@/lib/tagColors";
import type { Tag, TagInput } from "@/types/tag";

/** Por matiz (roda de cores) — mesma lógica do backend (GET /tags já vem nessa ordem; usado aqui só pra reordenar localmente sem refetch). */
function byColor(a: Tag, b: Tag): number {
  const [ka, kb] = [tagColorSortKey(a.color), tagColorSortKey(b.color)];
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return ka[i] - kb[i];
  }
  return a.name.localeCompare(b.name);
}

/** Etiquetas globais do sistema — as mesmas para qualquer postagem. */
export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await getOrFetch("tags", fetchTags);
        if (cancelled) return;
        setTags([...data].sort(byColor));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro inesperado.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function create(input: TagInput) {
    const tag = await createTag(input);
    invalidate("tags");
    setTags((prev) => [...prev, tag].sort(byColor));
    return tag;
  }

  async function update(id: number, input: Partial<TagInput>) {
    const tag = await updateTag(id, input);
    invalidate("tags");
    setTags((prev) => prev.map((t) => (t.id === id ? tag : t)).sort(byColor));
    return tag;
  }

  async function remove(id: number) {
    await deleteTag(id);
    invalidate("tags");
    setTags((prev) => prev.filter((t) => t.id !== id));
  }

  return { tags, loading, error, create, update, remove };
}
