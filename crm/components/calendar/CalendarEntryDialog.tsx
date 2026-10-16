"use client";

import { useState } from "react";
import { AlignLeft, CalendarDays, ImagePlus, Paperclip, Users, X } from "lucide-react";
import type { CalendarEntry, CalendarEntryCreateInput, CalendarEntryUpdateInput } from "@/types/calendar";
import type { Client } from "@/types/client";
import ImageDropzone from "@/components/ui/ImageDropzone";
import MultiImageDropzone from "@/components/ui/MultiImageDropzone";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Cliente fixo do drawer — não há seletor, todo entry pertence a esse cliente. */
  clientId: number;
  defaultDate: string;
  /** Quando informado, uma nova postagem mostra um seletor de cliente (em vez de cliente fixo). */
  clients?: Client[];
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
    title: entry?.title ?? "",
    theme: entry?.theme ?? "",
    reference_image: entry?.reference_image ?? null,
    material_files: entry?.material_files ?? [],
    final_image: entry?.final_image ?? null,
    caption: entry?.caption ?? "",
  };
}

export default function CalendarEntryDialog({
  open,
  onClose,
  clientId,
  defaultDate,
  clients,
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

  // Layout em dois painéis (estilo card do Trello): à esquerda o conteúdo da
  // postagem (descrição, execução, anexos); à direita data e entrega.
  const labelCls = "flex items-center gap-2 text-sm font-semibold text-white";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <form
        onSubmit={handleSubmit}
        className="glass-modal flex w-full max-w-6xl max-h-[90vh] h-[90vh] flex-col overflow-hidden rounded-2xl"
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-white/10 px-6">
          <span className="rounded bg-white/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white/70">
            {entry ? "Editar postagem" : clients ? "Nova demanda" : "Nova postagem"}
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded-full p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          <div className="min-w-0 space-y-8 p-6 lg:flex-[3] lg:overflow-y-auto">
            <section>
              <input
                required={!entry}
                value={form.title}
                maxLength={200}
                onChange={(e) => update("title", e.target.value)}
                placeholder="Nome da publicação"
                aria-label="Nome da publicação"
                className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 -mx-2 text-2xl font-bold text-white outline-none placeholder:text-white/30 hover:border-white/10 focus:border-cyan/50 focus:bg-white/5"
              />
            </section>

            <section className="space-y-2">
              <div className={labelCls}>
                <AlignLeft className="h-4 w-4 text-white/40" />
                Descrição
              </div>
              <textarea
                required
                value={form.theme}
                onChange={(e) => update("theme", e.target.value)}
                placeholder="Tema / chamada do post"
                className="glass-input min-h-[110px] w-full rounded-lg px-3 py-2 text-base outline-none"
              />
            </section>

            <section className="space-y-3">
              <div className={labelCls}>
                <Paperclip className="h-4 w-4 text-white/40" />
                Anexos
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-xs text-white/50">Referência</p>
                  <ImageDropzone
                    value={form.reference_image}
                    onChange={(value) => update("reference_image", value)}
                  />
                </div>
                <div>
                  <p className="mb-1.5 text-xs text-white/50">Material</p>
                  <MultiImageDropzone
                    value={form.material_files}
                    onChange={(urls) => update("material_files", urls)}
                  />
                </div>
              </div>
            </section>
          </div>

          <aside className="min-w-0 space-y-6 border-t border-white/10 p-6 lg:flex-[2] lg:overflow-y-auto lg:border-l lg:border-t-0">
            {clients && !entry && (
              <section className="space-y-2">
                <div className={labelCls}>
                  <Users className="h-4 w-4 text-white/40" />
                  Cliente
                </div>
                <select
                  required
                  value={form.client_id}
                  onChange={(e) => update("client_id", Number(e.target.value))}
                  className="glass-input w-full rounded-lg px-3 py-2 text-sm outline-none"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </section>
            )}

            <section className="space-y-2">
              <div className={labelCls}>
                <CalendarDays className="h-4 w-4 text-white/40" />
                Data
              </div>
              <input
                required
                type="date"
                value={form.scheduled_date}
                onChange={(e) => update("scheduled_date", e.target.value)}
                className="glass-input w-full rounded-lg px-3 py-2 text-sm outline-none"
              />
            </section>

            {entry && (
              <section className="space-y-3">
                <div className={labelCls}>
                  <ImagePlus className="h-4 w-4 text-white/40" />
                  Entrega
                </div>
                <div>
                  <p className="mb-1.5 text-xs text-white/50">Imagem final</p>
                  <ImageDropzone value={form.final_image} onChange={(value) => update("final_image", value)} />
                </div>
                <div>
                  <p className="mb-1.5 text-xs text-white/50">Legenda</p>
                  <textarea
                    value={form.caption}
                    onChange={(e) => update("caption", e.target.value)}
                    placeholder="Legenda que vai junto com a postagem"
                    className="glass-input min-h-[120px] w-full rounded-lg px-3 py-2 text-sm outline-none"
                  />
                </div>
              </section>
            )}
          </aside>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-white/10 px-6 py-3">
          {error && <p className="mr-auto text-sm text-danger">{error}</p>}
          {entry && canDelete && onRequestDelete && (
            <button
              type="button"
              onClick={() => onRequestDelete(entry)}
              className="rounded-lg px-4 py-2 text-sm text-danger hover:text-danger/70"
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
      </form>
    </div>
  );
}
