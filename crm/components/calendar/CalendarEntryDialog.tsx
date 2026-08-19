"use client";

import { useState } from "react";
import type { CalendarEntry, CalendarEntryCreateInput, CalendarEntryUpdateInput } from "@/types/calendar";
import Field from "@/components/ui/Field";
import ImageDropzone from "@/components/ui/ImageDropzone";
import MultiImageDropzone from "@/components/ui/MultiImageDropzone";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Cliente fixo do drawer — não há seletor, todo entry pertence a esse cliente. */
  clientId: number;
  defaultDate: string;
  entry?: CalendarEntry | null;
  canDelete?: boolean;
  onCreate: (input: CalendarEntryCreateInput) => Promise<CalendarEntry>;
  onUpdate: (id: number, input: CalendarEntryUpdateInput) => Promise<CalendarEntry>;
  onRequestDelete?: (entry: CalendarEntry) => void;
};

function buildForm(entry: CalendarEntry | null | undefined, clientId: number, defaultDate: string) {
  return {
    client_id: entry?.client_id ?? clientId,
    scheduled_date: entry?.scheduled_date ?? defaultDate,
    theme: entry?.theme ?? "",
    execution_notes: entry?.execution_notes ?? "",
    reference_image: entry?.reference_image ?? null,
    material_files: entry?.material_files ?? [],
  };
}

export default function CalendarEntryDialog({
  open,
  onClose,
  clientId,
  defaultDate,
  entry,
  canDelete = false,
  onCreate,
  onUpdate,
  onRequestDelete,
}: Props) {
  const [form, setForm] = useState(() => buildForm(entry, clientId, defaultDate));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [openKey, setOpenKey] = useState(entry?.id ?? "new");

  // Reabre o form do zero quando o dialog é reaberto para uma entrada diferente.
  const currentKey = entry?.id ?? "new";
  if (currentKey !== openKey && open) {
    setForm(buildForm(entry, clientId, defaultDate));
    setOpenKey(currentKey);
  }

  if (!open) return null;

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleClose() {
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (entry) {
        await onUpdate(entry.id, form);
      } else {
        await onCreate(form);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="glass-modal w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-white mb-4">
          {entry ? "Editar postagem" : "Nova postagem"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Data">
            <input
              required
              type="date"
              value={form.scheduled_date}
              onChange={(e) => update("scheduled_date", e.target.value)}
              className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
            />
          </Field>

          <Field label="Descrição">
            <textarea
              required
              value={form.theme}
              onChange={(e) => update("theme", e.target.value)}
              placeholder="Tema / chamada do post"
              className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full min-h-[70px]"
            />
          </Field>

          <Field label="Execução">
            <textarea
              required
              value={form.execution_notes}
              onChange={(e) => update("execution_notes", e.target.value)}
              placeholder="O que vai ser feito"
              className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full min-h-[70px]"
            />
          </Field>

          <Field label="Referência (opcional)">
            <ImageDropzone
              value={form.reference_image}
              onChange={(value) => update("reference_image", value)}
            />
          </Field>

          <Field label="Material a ser usado (opcional)">
            <MultiImageDropzone
              value={form.material_files}
              onChange={(urls) => update("material_files", urls)}
            />
          </Field>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="mt-2 flex items-center justify-end gap-3">
            {entry && canDelete && onRequestDelete && (
              <button
                type="button"
                onClick={() => onRequestDelete(entry)}
                className="mr-auto rounded-lg px-4 py-2 text-sm text-danger hover:text-danger/70"
              >
                Remover
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg px-4 py-2 text-sm text-white/70 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-dark disabled:opacity-60"
            >
              {loading ? "Salvando..." : entry ? "Salvar" : "Criar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
