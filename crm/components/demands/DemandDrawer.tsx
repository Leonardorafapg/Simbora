"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { ChecklistItem, Demand, DemandStatus, DemandUpdateInput } from "@/types/demand";
import { DEMAND_STATUSES, DEMAND_STATUS_LABELS } from "@/types/demand";
import type { Client } from "@/types/client";
import type { TeamMember } from "@/types/team";
import { useDemandCalendarEntry } from "@/hooks/useDemandCalendarEntry";
import Field from "@/components/ui/Field";
import UserSelect from "@/components/ui/UserSelect";
import ClientSelect from "@/components/ui/ClientSelect";
import ChecklistEditor from "./ChecklistEditor";
import DemandAttachments from "./DemandAttachments";
import DemandDeliverable from "./DemandDeliverable";
import { actionsFor } from "./DemandCard";

type Props = {
  demand: Demand | null;
  clients: Client[];
  teamMembers: TeamMember[];
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onUpdate: (id: number, input: DemandUpdateInput) => Promise<Demand>;
  onChangeStatus: (demand: Demand, status: DemandStatus) => void;
  onRequestDelete: (demand: Demand) => void;
};

function buildForm(demand: Demand) {
  return {
    title: demand.title,
    client_id: demand.client_id,
    assignee_id: demand.assignee_id,
    status: demand.status,
    due_date: demand.due_date ?? "",
    notes: demand.notes ?? "",
    has_material: demand.has_material,
    checklist: demand.checklist,
  };
}

function DemandDrawerContent({
  demand,
  clients,
  teamMembers,
  canEdit,
  canDelete,
  onBack,
  onUpdate,
  onChangeStatus,
  onRequestDelete,
}: Omit<Props, "onClose" | "demand"> & { demand: Demand; onBack: () => void }) {
  const [form, setForm] = useState(() => buildForm(demand));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCalendarEntry = demand.calendar_entry_id !== null;
  const { entry, loading: entryLoading, error: entryError, saveAssets } = useDemandCalendarEntry(
    demand.id,
    hasCalendarEntry,
  );

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const actions = actionsFor(demand);

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          {canEdit ? (
            <input
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              className="glass-input rounded-lg px-3 py-2 text-lg font-semibold w-full outline-none"
            />
          ) : (
            <h2 className="text-lg font-semibold text-white">{demand.title}</h2>
          )}
          {demand.calendar_entry_id && <p className="text-xs text-white/40 mt-1">Nascida de uma postagem do calendário.</p>}
        </div>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 rounded-full p-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {canEdit && actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {actions.map((action) => (
            <button
              key={action.target}
              type="button"
              onClick={() => onChangeStatus(demand, action.target)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                action.tone === "danger" ? "bg-danger/15 text-danger hover:bg-danger/25" : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      <div className="glass-card rounded-2xl p-4 space-y-3 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Cliente">
            <ClientSelect options={clients} value={form.client_id} onChange={(v) => update("client_id", v)} disabled={!canEdit} />
          </Field>
          <Field label="Responsável">
            <UserSelect options={teamMembers} value={form.assignee_id} onChange={(v) => update("assignee_id", v)} disabled={!canEdit} />
          </Field>
          <Field label="Prazo">
            <input
              type="date"
              disabled={!canEdit}
              value={form.due_date}
              onChange={(e) => update("due_date", e.target.value)}
              className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full disabled:opacity-60"
            />
          </Field>
          <Field label="Status">
            <select
              disabled={!canEdit}
              value={form.status}
              onChange={(e) => update("status", e.target.value as DemandStatus)}
              className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full disabled:opacity-60"
            >
              {DEMAND_STATUSES.filter((s) => demand.is_art || (s !== "em_aprovacao" && s !== "reprovada")).map((s) => (
                <option key={s} value={s}>
                  {DEMAND_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            disabled={!canEdit}
            checked={form.has_material}
            onChange={(e) => update("has_material", e.target.checked)}
          />
          Já tem material (imagem/vídeo pronto — não precisa captar)
        </label>

        <Field label="Observação">
          <textarea
            disabled={!canEdit}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full min-h-[70px] disabled:opacity-60"
          />
        </Field>

        <Field label="Checklist">
          <ChecklistEditor items={form.checklist as ChecklistItem[]} onChange={(items) => update("checklist", items)} />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        {canEdit && (
          <div className="flex items-center justify-end gap-3 pt-1">
            {canDelete && (
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
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-dark disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        )}
      </div>

      {hasCalendarEntry && (
        <div className="grid lg:grid-cols-2 gap-4">
          <DemandAttachments entry={entry} loading={entryLoading} error={entryError} canEdit={canEdit} onSave={saveAssets} />
          <DemandDeliverable entry={entry} loading={entryLoading} error={entryError} canEdit={canEdit} onSave={saveAssets} />
        </div>
      )}
    </>
  );
}

/**
 * Modal centralizado por cima da tela (como o card do Trello), não um
 * painel lateral — mesmo padrão dos outros modais do app (overlay
 * escurecido + card centralizado), só que mais largo pra caber anexos e
 * entrega lado a lado.
 */
export default function DemandDrawer({ demand, onClose, ...rest }: Props) {
  if (!demand) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="glass-modal w-full max-w-4xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <DemandDrawerContent key={demand.id} demand={demand} onBack={onClose} {...rest} />
      </div>
    </div>
  );
}
