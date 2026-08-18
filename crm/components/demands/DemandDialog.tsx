"use client";

import { useState } from "react";
import type { ChecklistItem, Demand, DemandCreateInput, DemandUpdateInput } from "@/types/demand";
import { DEMAND_STATUSES, DEMAND_STATUS_LABELS } from "@/types/demand";
import type { Client } from "@/types/client";
import type { TeamMember } from "@/types/team";
import Field from "@/components/ui/Field";
import UserSelect from "@/components/ui/UserSelect";
import ClientSelect from "@/components/ui/ClientSelect";
import ChecklistEditor from "./ChecklistEditor";

type Props = {
  open: boolean;
  onClose: () => void;
  demand?: Demand | null;
  clients: Client[];
  teamMembers: TeamMember[];
  canDelete?: boolean;
  onCreate: (input: DemandCreateInput) => Promise<Demand>;
  onUpdate: (id: number, input: DemandUpdateInput) => Promise<Demand>;
  onRequestDelete?: (demand: Demand) => void;
};

function buildForm(demand: Demand | null | undefined) {
  return {
    title: demand?.title ?? "",
    client_id: demand?.client_id ?? null,
    assignee_id: demand?.assignee_id ?? null,
    status: demand?.status ?? "pendente",
    due_date: demand?.due_date ?? "",
    notes: demand?.notes ?? "",
    is_art: demand?.is_art ?? false,
    has_material: demand?.has_material ?? false,
    checklist: demand?.checklist ?? ([] as ChecklistItem[]),
  };
}

export default function DemandDialog({
  open,
  onClose,
  demand,
  clients,
  teamMembers,
  canDelete = false,
  onCreate,
  onUpdate,
  onRequestDelete,
}: Props) {
  const [form, setForm] = useState(() => buildForm(demand));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [openKey, setOpenKey] = useState(demand?.id ?? "new");

  const currentKey = demand?.id ?? "new";
  if (currentKey !== openKey && open) {
    setForm(buildForm(demand));
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
      if (demand) {
        await onUpdate(demand.id, {
          title: form.title,
          client_id: form.client_id,
          assignee_id: form.assignee_id,
          status: form.status,
          due_date: form.due_date || null,
          notes: form.notes,
          has_material: form.has_material,
          checklist: form.checklist,
        });
      } else {
        await onCreate({
          title: form.title,
          client_id: form.client_id,
          assignee_id: form.assignee_id,
          due_date: form.due_date || null,
          notes: form.notes,
          is_art: form.is_art,
          has_material: form.has_material,
          checklist: form.checklist,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  const bornFromCalendar = !!demand?.calendar_entry_id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="glass-modal w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-white mb-1">
          {demand ? "Editar demanda" : "Nova demanda"}
        </h2>
        {bornFromCalendar && (
          <p className="text-xs text-white/40 mb-4">Nascida de uma postagem do calendário.</p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-4">
          <Field label="Título">
            <input
              required
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
            />
          </Field>

          <Field label="Cliente (opcional)">
            <ClientSelect options={clients} value={form.client_id} onChange={(v) => update("client_id", v)} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Responsável">
              <UserSelect
                options={teamMembers}
                value={form.assignee_id}
                onChange={(v) => update("assignee_id", v)}
              />
            </Field>
            <Field label="Prazo">
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => update("due_date", e.target.value)}
                className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
              />
            </Field>
          </div>

          {demand && (
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => update("status", e.target.value as Demand["status"])}
                className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
              >
                {DEMAND_STATUSES.filter((s) => demand.is_art || (s !== "em_aprovacao" && s !== "reprovada")).map(
                  (s) => (
                    <option key={s} value={s}>
                      {DEMAND_STATUS_LABELS[s]}
                    </option>
                  ),
                )}
              </select>
            </Field>
          )}

          <div className="flex flex-col gap-2">
            {!demand && (
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={form.is_art}
                  onChange={(e) => update("is_art", e.target.checked)}
                />
                É arte (passa por aprovação do cliente)
              </label>
            )}
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={form.has_material}
                onChange={(e) => update("has_material", e.target.checked)}
              />
              Já tem material (imagem/vídeo pronto — não precisa captar)
            </label>
          </div>

          <Field label="Observação">
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full min-h-[70px]"
            />
          </Field>

          <Field label="Checklist">
            <ChecklistEditor items={form.checklist} onChange={(items) => update("checklist", items)} />
          </Field>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="mt-2 flex items-center justify-end gap-3">
            {demand && canDelete && onRequestDelete && (
              <button
                type="button"
                onClick={() => onRequestDelete(demand)}
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
              {loading ? "Salvando..." : demand ? "Salvar" : "Criar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
