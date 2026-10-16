"use client";

import { useState } from "react";
import { ImagePlus, Paperclip, X } from "lucide-react";
import type { CalendarEntry, CalendarEntryCreateInput, CalendarEntryStatus, CalendarEntryUpdateInput } from "@/types/calendar";
import { CALENDAR_ENTRY_STATUSES, CALENDAR_ENTRY_STATUS_LABELS } from "@/types/calendar";
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
    final_image: entry?.final_image ?? null,
    caption: entry?.caption ?? "",
    status: (entry?.status ?? "producao") as CalendarEntryStatus,
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

  // Mesmo layout do DemandDrawer da Produção: modal largo, cabeçalho com
  // fechar, card de campos e card de anexos logo abaixo.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="glass-modal w-full max-w-4xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="flex items-start justify-between gap-4 mb-6">
            <h2 className="text-lg font-semibold text-white">{entry ? "Editar postagem" : "Nova postagem"}</h2>
            <button
              type="button"
              onClick={handleClose}
              className="shrink-0 rounded-full p-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="glass-card rounded-2xl p-4 space-y-3 mb-6">
            <Field label="Data">
              <input
                required
                type="date"
                value={form.scheduled_date}
                onChange={(e) => update("scheduled_date", e.target.value)}
                className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
              />
            </Field>

            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => update("status", e.target.value as CalendarEntryStatus)}
                className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
              >
                {CALENDAR_ENTRY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CALENDAR_ENTRY_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
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

            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="flex items-center justify-end gap-3 pt-1">
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
                type="submit"
                disabled={loading}
                className="rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-dark disabled:opacity-60"
              >
                {loading ? "Salvando..." : entry ? "Salvar alterações" : "Criar"}
              </button>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Paperclip className="h-4 w-4 text-white/40" />
              Anexos
            </div>
            <div className="grid lg:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-white/50 mb-1.5">Referência (post principal)</p>
                <ImageDropzone
                  value={form.reference_image}
                  onChange={(value) => update("reference_image", value)}
                />
              </div>
              <div>
                <p className="text-xs text-white/50 mb-1.5">Material</p>
                <MultiImageDropzone
                  value={form.material_files}
                  onChange={(urls) => update("material_files", urls)}
                />
              </div>
            </div>
          </div>

          {entry && (
            <div className="glass-card rounded-2xl p-4 space-y-3 mt-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <ImagePlus className="h-4 w-4 text-white/40" />
                Entrega
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-white/50 mb-1.5">Imagem final</p>
                  <ImageDropzone value={form.final_image} onChange={(value) => update("final_image", value)} />
                </div>
                <div>
                  <p className="text-xs text-white/50 mb-1.5">Legenda</p>
                  <textarea
                    value={form.caption}
                    onChange={(e) => update("caption", e.target.value)}
                    placeholder="Legenda que vai junto com a postagem"
                    className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full min-h-[120px]"
                  />
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
