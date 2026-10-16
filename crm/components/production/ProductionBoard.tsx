"use client";

import { useState } from "react";
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useCalendarEntries } from "@/hooks/useCalendarEntries";
import { useClients } from "@/hooks/useClients";
import type { CalendarEntry, CalendarEntryStatus } from "@/types/calendar";
import { CALENDAR_ENTRY_STATUSES } from "@/types/calendar";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import CalendarEntryDialog from "@/components/calendar/CalendarEntryDialog";
import KanbanColumn from "./KanbanColumn";

type Props = {
  canEdit: boolean;
  canDelete: boolean;
};

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Quadro de produção: cada postagem do calendário é um card, arrastado entre os quadros. */
export default function ProductionBoard({ canEdit, canDelete }: Props) {
  const [clientId, setClientId] = useState<number | undefined>(undefined);
  const [month, setMonth] = useState(currentMonth());
  const [selected, setSelected] = useState<CalendarEntry | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CalendarEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { entries, loading, error, create, update, remove } = useCalendarEntries(clientId, month);
  const { clients } = useClients();

  // Distância mínima antes de considerar "arrastando" — sem isso, todo
  // clique no card (pra abrir o drawer) seria capturado como um drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const entry = active.data.current?.entry as CalendarEntry | undefined;
    const target = over.id as CalendarEntryStatus;
    if (!entry || entry.status === target) return;

    setActionError(null);
    try {
      await update(entry.id, { status: target });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao mover a postagem.");
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setActionError(null);
    try {
      await remove(pendingDelete.id);
      setPendingDelete(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao remover.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="relative h-full p-6 sm:p-8 space-y-4">
      <h1 className="text-2xl font-semibold text-white">Produção</h1>

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={clientId ?? ""}
          onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : undefined)}
          className="glass-input rounded-lg px-3 py-2 text-sm outline-none"
        >
          <option value="">Todos os clientes</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="glass-input rounded-lg px-3 py-2 text-sm outline-none"
        />
        {month && (
          <button type="button" onClick={() => setMonth("")} className="text-xs text-white/50 hover:text-white">
            Ver todos os meses
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-white/50">Carregando...</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {actionError && <p className="text-sm text-danger">{actionError}</p>}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {/* Mobile: colunas lado a lado com scroll horizontal e snap; a partir de sm vira grid. */}
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-5 sm:overflow-visible sm:pb-0 items-start">
          {CALENDAR_ENTRY_STATUSES.map((status) => (
            <div key={status} className="w-[85vw] shrink-0 snap-start sm:w-auto sm:shrink">
              <KanbanColumn
                status={status}
                entries={entries.filter((e) => e.status === status)}
                clients={clients}
                canEdit={canEdit}
                onSelect={setSelected}
              />
            </div>
          ))}
        </div>
      </DndContext>

      {selected && (
        <CalendarEntryDialog
          open
          onClose={() => setSelected(null)}
          clientId={selected.client_id}
          defaultDate={selected.scheduled_date}
          entry={selected}
          canDelete={canDelete}
          onCreate={create}
          onUpdate={update}
          onRequestDelete={(entry) => {
            setSelected(null);
            setPendingDelete(entry);
          }}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remover postagem?"
        description="Essa ação remove a postagem permanentemente."
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
