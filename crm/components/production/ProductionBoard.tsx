"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { deadlineInfo, urgencyRank } from "@/lib/deadline";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useCalendarEntries } from "@/hooks/useCalendarEntries";
import { useClients } from "@/hooks/useClients";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import type { CalendarEntry, CalendarEntryCreateInput, CalendarEntryStatus } from "@/types/calendar";
import { CALENDAR_ENTRY_STATUSES } from "@/types/calendar";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import CalendarEntryDialog from "@/components/calendar/CalendarEntryDialog";
import KanbanColumn from "./KanbanColumn";
import { PostCardOverlay } from "./PostCard";

type Props = {
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
};

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Quadro de produção: cada postagem do calendário é um card, arrastado entre os quadros.
 * Só entram postagens de cronogramas finalizados (aprovados) — o resto ainda está em planejamento.
 */
export default function ProductionBoard({ canEdit, canCreate, canDelete }: Props) {
  const [clientId, setClientId] = useState<number | undefined>(undefined);
  const [assigneeId, setAssigneeId] = useState<number | undefined>(undefined);
  const [deadlineFilter, setDeadlineFilter] = useState<"" | "atrasados" | "vencem">("");
  const [month, setMonth] = useState(currentMonth());
  const [selected, setSelected] = useState<CalendarEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [activeEntry, setActiveEntry] = useState<CalendarEntry | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CalendarEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { entries, loading, error, create, update, remove } = useCalendarEntries(clientId, month, "finalizado", assigneeId);
  const { clients } = useClients();
  const { members } = useTeamMembers();

  // Prazo: filtra e põe os mais urgentes no topo de cada coluna.
  const visibleEntries = entries
    .map((entry) => ({ entry, info: deadlineInfo(entry) }))
    .filter(({ info }) => {
      if (deadlineFilter === "atrasados") return info.state === "atrasado";
      if (deadlineFilter === "vencem") return info.state === "vence_hoje" || info.state === "vence_amanha";
      return true;
    })
    .sort((a, b) => urgencyRank(a.info) - urgencyRank(b.info) || a.entry.scheduled_date.localeCompare(b.entry.scheduled_date))
    .map(({ entry }) => entry);

  // Distância mínima antes de considerar "arrastando" — sem isso, todo
  // clique no card (pra abrir o drawer) seria capturado como um drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragStart(event: DragStartEvent) {
    setActiveEntry((event.active.data.current?.entry as CalendarEntry | undefined) ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveEntry(null);
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

  // Demanda nova nasce no quadro mesmo com o cronograma do mês já finalizado.
  // Ajusta os filtros pra ela não sumir da tela depois de criada.
  async function handleCreate(input: CalendarEntryCreateInput) {
    const entry = await create(input, { fromProduction: true });
    if (month && entry.scheduled_date.slice(0, 7) !== month) setMonth(entry.scheduled_date.slice(0, 7));
    if (clientId && clientId !== entry.client_id) setClientId(entry.client_id);
    if (assigneeId && assigneeId !== entry.assignee_id) setAssigneeId(undefined);
    return entry;
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
    <div className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6 sm:p-8">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-white">Produção</h1>
        {canCreate && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            disabled={clients.length === 0}
            className="flex items-center gap-2 rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-dark disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Nova demanda
          </button>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 flex-wrap">
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
        <select
          value={assigneeId ?? ""}
          onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : undefined)}
          className="glass-input rounded-lg px-3 py-2 text-sm outline-none"
          aria-label="Filtrar por responsável"
        >
          <option value="">Todos os responsáveis</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name}
            </option>
          ))}
        </select>
        <select
          value={deadlineFilter}
          onChange={(e) => setDeadlineFilter(e.target.value as "" | "atrasados" | "vencem")}
          className="glass-input rounded-lg px-3 py-2 text-sm outline-none"
          aria-label="Filtrar por prazo"
        >
          <option value="">Todos os prazos</option>
          <option value="atrasados">Atrasados</option>
          <option value="vencem">Vencem hoje ou amanhã</option>
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

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveEntry(null)}
      >
        {/* Colunas dividem a largura toda (mínimo 220px cada): rola pro lado só se não couber, nunca pra baixo —
            a altura é a da tela e cada coluna rola por dentro. */}
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto overflow-y-hidden pb-2">
          {CALENDAR_ENTRY_STATUSES.map((status) => (
            <div key={status} className="h-full min-w-[220px] flex-1">
              <KanbanColumn
                status={status}
                entries={visibleEntries.filter((e) => e.status === status)}
                clients={clients}
                canEdit={canEdit}
                onSelect={setSelected}
              />
            </div>
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeEntry ? (
            <PostCardOverlay entry={activeEntry} client={clients.find((c) => c.id === activeEntry.client_id)} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {creating && (
        <CalendarEntryDialog
          open
          onClose={() => setCreating(false)}
          clientId={clientId ?? clients[0].id}
          clients={clients}
          defaultDate={`${month || currentMonth()}-${month ? "01" : String(new Date().getDate()).padStart(2, "0")}`}
          onCreate={handleCreate}
          onUpdate={update}
        />
      )}

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
