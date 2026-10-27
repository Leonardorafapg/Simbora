"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { fromLocalInput, toLocalInput } from "@/lib/agenda";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Field from "@/components/ui/Field";
import MultiSelect from "@/components/ui/MultiSelect";
import type { AgendaEvent, AgendaEventInput } from "@/types/agenda";
import type { TeamDirectoryEntry } from "@/types/team";

type Props = {
  /** null = compromisso novo. */
  event: AgendaEvent | null;
  /** Dia (AAAA-MM-DD) pré-selecionado ao criar. */
  initialDate: string;
  currentUserId: number | null;
  members: TeamDirectoryEntry[];
  onSave: (input: AgendaEventInput) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
  onClose: () => void;
};

/** Início padrão de um compromisso novo: 09:00 do dia escolhido, duração de 1 h. */
function defaultRange(date: string) {
  return { start: `${date}T09:00`, end: `${date}T10:00` };
}

export default function AgendaEventDialog({ event, initialDate, currentUserId, members, onSave, onDelete, onClose }: Props) {
  const isNew = event === null;
  const canEdit = isNew || event.created_by === currentUserId;

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [start, setStart] = useState(event ? toLocalInput(event.starts_at) : defaultRange(initialDate).start);
  const [end, setEnd] = useState(event ? toLocalInput(event.ends_at) : defaultRange(initialDate).end);
  // O criador sempre participa — não entra na lista de convidados editável.
  const [guestIds, setGuestIds] = useState<number[]>(
    event ? event.participants.map((p) => p.id).filter((id) => id !== event.created_by) : [],
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guestOptions = members.filter((m) => m.is_active && m.id !== (event?.created_by ?? currentUserId)).map((m) => ({ value: m.id, label: m.full_name }));
  const creator = event?.participants.find((p) => p.id === event.created_by);

  // Ao mudar o início, o fim acompanha mantendo a duração (como nos calendários comuns).
  function changeStart(value: string) {
    const duration = new Date(end).getTime() - new Date(start).getTime();
    setStart(value);
    if (value && duration > 0) setEnd(toLocalInput(new Date(new Date(value).getTime() + duration).toISOString()));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Dê um título ao compromisso.");
    if (!start || !end) return setError("Escolha o início e o fim.");
    if (new Date(end) <= new Date(start)) return setError("O fim precisa ser depois do início.");
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        starts_at: fromLocalInput(start),
        ends_at: fromLocalInput(end),
        participant_ids: guestIds,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await onDelete();
      onClose();
    } catch (err) {
      setConfirmDelete(false);
      setError(err instanceof Error ? err.message : "Não foi possível cancelar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form onSubmit={handleSubmit} className="glass-modal max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">
            {isNew ? "Novo compromisso" : canEdit ? "Editar compromisso" : "Compromisso"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-text-muted hover:text-text">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Título">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canEdit}
              maxLength={200}
              autoFocus={isNew}
              placeholder="Ex.: Reunião de alinhamento"
              className="glass-input rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-70"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Início">
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => changeStart(e.target.value)}
                disabled={!canEdit}
                className="glass-input rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-70"
              />
            </Field>
            <Field label="Fim">
              <input
                type="datetime-local"
                value={end}
                min={start}
                onChange={(e) => setEnd(e.target.value)}
                disabled={!canEdit}
                className="glass-input rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-70"
              />
            </Field>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm text-text">Participantes</p>
            {canEdit ? (
              <MultiSelect
                fullWidth
                options={guestOptions}
                value={guestIds}
                onChange={setGuestIds}
                allLabel="Só eu"
                pluralLabel="convidados"
                ariaLabel="Convidados"
              />
            ) : (
              <ul className="flex flex-wrap gap-2">
                {event?.participants.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 rounded-full bg-surface-2 py-1 pl-1 pr-3 text-xs text-text">
                    <Avatar name={p.full_name} photoUrl={p.photo_url} size="sm" />
                    {p.full_name}
                  </li>
                ))}
              </ul>
            )}
            {canEdit && !isNew && creator && <p className="text-xs text-text-faint">Marcado por você.</p>}
            {!canEdit && creator && <p className="text-xs text-text-faint">Marcado por {creator.full_name}. Só quem marcou pode alterar.</p>}
          </div>

          <Field label="Descrição">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canEdit}
              placeholder="Pauta, link da chamada, local..."
              className="glass-input min-h-[90px] rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-70"
            />
          </Field>
        </div>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        <div className="mt-6 flex items-center justify-between gap-3">
          {canEdit && !isNew ? (
            <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={saving}>
              Cancelar compromisso
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              {canEdit ? "Fechar" : "Ok"}
            </Button>
            {canEdit && (
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : isNew ? "Marcar" : "Salvar"}
              </Button>
            )}
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title="Cancelar este compromisso?"
        description="Os participantes são avisados do cancelamento."
        confirmLabel="Cancelar compromisso"
        loading={saving}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
