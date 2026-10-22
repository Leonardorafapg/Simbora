"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Plus, Tag as TagIcon, Trash2, X } from "lucide-react";
import { useTags } from "@/hooks/useTags";
import { TAG_COLOR_CLASSES, tagChipClass } from "@/lib/tagColors";
import { TAG_COLOR_KEYS, type Tag, type TagColor } from "@/types/tag";

type Props = {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
};

function ColorSwatches({ value, onChange }: { value: TagColor; onChange: (color: TagColor) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TAG_COLOR_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          title={TAG_COLOR_CLASSES[key].label}
          aria-label={TAG_COLOR_CLASSES[key].label}
          onClick={() => onChange(key)}
          className={`h-6 w-9 rounded ${TAG_COLOR_CLASSES[key].swatch} ${
            value === key ? "ring-2 ring-white" : "opacity-80 hover:opacity-100"
          }`}
        />
      ))}
    </div>
  );
}

/**
 * Etiquetas estilo Trello: chips da postagem + popover para marcar/desmarcar,
 * criar, renomear/recolorir e apagar. As etiquetas são globais (ficam no
 * sistema), a postagem só guarda quais estão aplicadas.
 */
export default function TagPicker({ selectedIds, onChange }: Props) {
  const { tags, create, update, remove } = useTags();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [newColor, setNewColor] = useState<TagColor>("blue");
  const [editing, setEditing] = useState<Tag | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<TagColor>("gray");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const selected = tags.filter((t) => selectedIds.includes(t.id));
  const trimmed = query.trim();
  const visible = tags.filter((t) => t.name.toLowerCase().includes(trimmed.toLowerCase()));
  const exactExists = tags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase());

  function toggle(id: number) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id]);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }

  function handleCreate() {
    if (!trimmed || exactExists) return;
    void run(async () => {
      const tag = await create({ name: trimmed, color: newColor });
      onChange([...selectedIds, tag.id]);
      setQuery("");
    });
  }

  function startEdit(tag: Tag) {
    setEditing(tag);
    setEditName(tag.name);
    setEditColor((TAG_COLOR_KEYS as readonly string[]).includes(tag.color) ? (tag.color as TagColor) : "gray");
    setError(null);
  }

  function handleSaveEdit() {
    if (!editing) return;
    void run(async () => {
      await update(editing.id, { name: editName, color: editColor });
      setEditing(null);
    });
  }

  function handleDelete() {
    if (!editing) return;
    if (!window.confirm(`Apagar a etiqueta "${editing.name}"? Ela sai de todas as postagens.`)) return;
    const id = editing.id;
    void run(async () => {
      await remove(id);
      onChange(selectedIds.filter((i) => i !== id));
      setEditing(null);
    });
  }

  return (
    <div ref={rootRef} className="relative space-y-2">
      <div className="text-xs font-semibold text-text-muted">Etiquetas</div>
      <div className="flex flex-wrap items-center gap-2">
        {selected.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => setOpen(true)}
            className={`rounded px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${tagChipClass(tag.color)}`}
          >
            {tag.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-8 w-8 items-center justify-center rounded bg-surface-2 text-text transition hover:bg-white/20 hover:text-text"
          aria-label="Adicionar etiqueta"
          title="Adicionar etiqueta"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-3rem)] rounded-xl border border-border bg-[#1f2023] p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold text-text">
              <TagIcon className="h-4 w-4 text-text-faint" />
              {editing ? "Editar etiqueta" : "Etiquetas"}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-text-muted hover:bg-surface-2 hover:text-text"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {editing ? (
            <div className="space-y-3">
              <input
                value={editName}
                maxLength={40}
                onChange={(e) => setEditName(e.target.value)}
                className="glass-input w-full rounded-lg px-3 py-2 text-sm outline-none"
                aria-label="Nome da etiqueta"
              />
              <ColorSwatches value={editColor} onChange={setEditColor} />
              {error && <p className="text-xs text-danger">{error}</p>}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-danger hover:bg-danger/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Apagar
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="rounded-lg px-3 py-1.5 text-xs text-text-muted hover:text-text"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={busy || !editName.trim()}
                    className="rounded-lg bg-cyan px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-60"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
                placeholder="Buscar ou criar etiqueta"
                className="glass-input w-full rounded-lg px-3 py-2 text-sm outline-none"
              />

              <div className="max-h-52 space-y-1.5 overflow-y-auto">
                {visible.length === 0 && (
                  <p className="px-1 text-xs text-text-faint">
                    {tags.length === 0 ? "Nenhuma etiqueta criada ainda." : "Nenhuma etiqueta encontrada."}
                  </p>
                )}
                {visible.map((tag) => {
                  const active = selectedIds.includes(tag.id);
                  return (
                    <div key={tag.id} className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggle(tag.id)}
                        className={`flex min-w-0 flex-1 items-center justify-between rounded px-3 py-1.5 text-left text-xs font-bold uppercase tracking-wide ${tagChipClass(tag.color)}`}
                      >
                        <span className="truncate">{tag.name}</span>
                        {active && <Check className="h-4 w-4 shrink-0" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(tag)}
                        className="rounded p-1.5 text-text-faint hover:bg-surface-2 hover:text-text"
                        aria-label={`Editar etiqueta ${tag.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {trimmed && !exactExists && (
                <div className="space-y-2 border-t border-border pt-3">
                  <ColorSwatches value={newColor} onChange={setNewColor} />
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs font-semibold text-text hover:bg-white/20 disabled:opacity-60"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Criar &ldquo;{trimmed}&rdquo;
                  </button>
                </div>
              )}
              {error && <p className="text-xs text-danger">{error}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
