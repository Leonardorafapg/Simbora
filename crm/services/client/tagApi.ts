import type { Tag, TagInput } from "@/types/tag";

async function parseErrorMessage(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return data.message ?? fallback;
}

export async function fetchTags(): Promise<Tag[]> {
  const res = await fetch("/api/tags");
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível carregar as etiquetas."));
  return res.json();
}

export async function createTag(input: TagInput): Promise<Tag> {
  const res = await fetch("/api/tags", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível criar a etiqueta."));
  return res.json();
}

export async function updateTag(id: number, input: Partial<TagInput>): Promise<Tag> {
  const res = await fetch(`/api/tags/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível salvar a etiqueta."));
  return res.json();
}

export async function deleteTag(id: number): Promise<void> {
  const res = await fetch(`/api/tags/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível remover a etiqueta."));
}
