"use client";

import { useEffect, useState } from "react";
import { createTag, deleteTag, fetchTags, updateTag } from "@/services/client/tagApi";
import { getOrFetch, invalidate } from "@/lib/dataCache";
import type { Tag, TagInput } from "@/types/tag";

const byName = (a: Tag, b: Tag) => a.name.localeCompare(b.name);

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
        setTags([...data].sort(byName));
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
    setTags((prev) => [...prev, tag].sort(byName));
    return tag;
  }

  async function update(id: number, input: Partial<TagInput>) {
    const tag = await updateTag(id, input);
    invalidate("tags");
    setTags((prev) => prev.map((t) => (t.id === id ? tag : t)).sort(byName));
    return tag;
  }

  async function remove(id: number) {
    await deleteTag(id);
    invalidate("tags");
    setTags((prev) => prev.filter((t) => t.id !== id));
  }

  return { tags, loading, error, create, update, remove };
}
