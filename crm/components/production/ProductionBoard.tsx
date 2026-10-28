"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Rows3, Search, SlidersHorizontal, X } from "lucide-react";
import { useDensity } from "@/components/layout/ThemeToggle";
import { deadlineInfo, urgencyRank } from "@/lib/deadline";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useCalendarEntries } from "@/hooks/useCalendarEntries";
import { useClients } from "@/hooks/useClients";
import { useTeamDirectory } from "@/hooks/useTeamDirectory";
import { useTags } from "@/hooks/useTags";
import { useInstagramByEntries } from "@/hooks/useInstagram";
import type { CalendarEntry, CalendarEntryCreateInput, CalendarEntryStatus } from "@/types/calendar";
import { CALENDAR_ENTRY_STATUSES } from "@/types/calendar";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import { TopProgress } from "@/components/ui/Skeleton";
import MultiSelect from "@/components/ui/MultiSelect";
import CalendarEntryDialog from "@/components/calendar/CalendarEntryDialog";
import KanbanColumn from "./KanbanColumn";
import { PostCardOverlay } from "./PostCard";

type Props = {
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
  canViewInstagram: boolean;
  canManageInstagram: boolean;
};

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Quadro de produção: cada postagem do calendário é um card, arrastado entre os quadros.
 * Só entram postagens de cronogramas finalizados (aprovados) — o resto ainda está em planejamento.
 */
export default function ProductionBoard({ canEdit, canCreate, canDelete, canViewInstagram, canManageInstagram }: Props) {
  const [clientIds, setClientIds] = useState<number[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
  const [requesterIds, setRequesterIds] = useState<number[]>([]);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [deadlineFilter, setDeadlineFilter] = useState<"" | "atrasados" | "vencem">("");
  // Link de aviso (/production?demanda=7&mes=2026-11): abre no mês certo e já com a demanda aberta.
  const searchParams = useSearchParams();
  const linkedMonth = searchParams.get("mes");
  const linkedEntryId = Number(searchParams.get("demanda")) || null;
  const [month, setMonth] = useState(() => (linkedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(linkedMonth) ? linkedMonth : currentMonth()));
  const openedLinkedEntry = useRef<number | null>(null);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { density, toggleDensity } = useDensity();
  const filtersRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<CalendarEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [activeEntry, setActiveEntry] = useState<CalendarEntry | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CalendarEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { entries, loading, error, create, update, remove } = useCalendarEntries(undefined, month, "finalizado");
  const { clients } = useClients();
  const { members } = useTeamDirectory();
  const { tags } = useTags();
  // Badge do Instagram: só faz sentido em postagem aprovada/publicada (ou que já teve agendamento).
  const { byEntry: instagramByEntry, refresh: refreshInstagram } = useInstagramByEntries(
    entries.filter((e) => (["finalizados", "publicados"] as string[]).includes(e.status)).map((e) => e.id),
    canViewInstagram,
  );

  useEffect(() => {
    if (!linkedEntryId || openedLinkedEntry.current === linkedEntryId) return;
    const entry = entries.find((e) => e.id === linkedEntryId);
    if (!entry) return;
    const timer = window.setTimeout(() => {
      openedLinkedEntry.current = linkedEntryId; // abre uma vez só: fechar o card não reabre
      setSelected(entry);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [entries, linkedEntryId]);

  useEffect(() => {
    if (!filtersOpen) return;
    const onDown = (e: MouseEvent) => {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) setFiltersOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [filtersOpen]);

  // Busca por texto (sem diferenciar acentos/maiúsculas): título, descrição, cliente e etiquetas.
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const term = normalize(search.trim());
  const matchesSearch = (entry: CalendarEntry) => {
    if (!term) return true;
    const clientName = clients.find((c) => c.id === entry.client_id)?.name ?? "";
    const haystack = [entry.title ?? "", entry.theme, clientName, ...entry.tags.map((t) => t.name)].join(" ");
    return normalize(haystack).includes(term);
  };

  const activeFilters =
    (clientIds.length ? 1 : 0) +
    (assigneeIds.length ? 1 : 0) +
    (requesterIds.length ? 1 : 0) +
    (tagIds.length ? 1 : 0) +
    (deadlineFilter ? 1 : 0) +
    (month !== currentMonth() ? 1 : 0);

  function clearFilters() {
    setClientIds([]);
    setAssigneeIds([]);
    setRequesterIds([]);
    setTagIds([]);
    setDeadlineFilter("");
    setMonth(currentMonth());
  }

  // Prazo: filtra e põe os mais urgentes no topo de cada coluna.
  const visibleEntries = entries
    .filter(matchesSearch)
    .map((entry) => ({ entry, info: deadlineInfo(entry) }))
    .filter(({ entry }) => clientIds.length === 0 || clientIds.includes(entry.client_id))
    .filter(({ entry }) => assigneeIds.length === 0 || (entry.assignee_id !== null && assigneeIds.includes(entry.assignee_id)))
    .filter(({ entry }) => requesterIds.length === 0 || (entry.requester_id !== null && requesterIds.includes(entry.requester_id)))
    .filter(({ entry }) => tagIds.length === 0 || entry.tags.some((tag) => tagIds.includes(tag.id)))
    .filter(({ info }) => {
      if (deadlineFilter === "atrasados") return info.state === "atrasado";
      if (deadlineFilter === "vencem") return info.state === "vence_hoje" || info.state === "vence_amanha";
      return true;
    })
    .sort((a, b) => urgencyRank(a.info) - urgencyRank(b.info) || a.entry.scheduled_date.localeCompare(b.entry.scheduled_date))
    .map(({ entry }) => entry);

  // Distância mínima antes de considerar "arrastando" — sem isso, todo
  // clique no card (pra abrir o drawer) seria capturado como um drag.
  // No celular o arrasto só começa após segurar o card (250ms), pra não brigar com a rolagem.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

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
    // Filtros que deixariam a demanda nova de fora são limpos, pra ela não sumir da tela.
    if (clientIds.length && !clientIds.includes(entry.client_id)) setClientIds([]);
    if (assigneeIds.length && (entry.assignee_id === null || !assigneeIds.includes(entry.assignee_id))) setAssigneeIds([]);
    if (requesterIds.length && (entry.requester_id === null || !requesterIds.includes(entry.requester_id))) setRequesterIds([]);
    if (tagIds.length && !entry.tags.some((tag) => tagIds.includes(tag.id))) setTagIds([]);
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
    <div className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-8">
      <PageHeader
        className="mb-0"
        title="Produção"
        description="Acompanhe cada postagem do briefing à publicação."
        actions={
          <>
            {canCreate && (
                      <Button onClick={() => setCreating(true)} disabled={clients.length === 0}>
                <Plus className="h-4 w-4" />
                Nova demanda
              </Button>
                    )}
          </>
        }
      />

      <div className="flex shrink-0 items-center gap-2 flex-wrap">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar demanda por título, descrição, cliente ou etiqueta"
            aria-label="Buscar demandas"
            className="glass-input w-full rounded-lg py-2 pl-9 pr-8 text-sm outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-text-muted hover:bg-surface-2 hover:text-text"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div ref={filtersRef} className="relative">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            className={`glass-input flex items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none ${
              activeFilters > 0 ? "border-accent-border" : ""
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
            {activeFilters > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-black">
                {activeFilters}
              </span>
            )}
          </button>

          {filtersOpen && (
            <div className="absolute left-0 top-full z-30 mt-2 w-[340px] max-w-[calc(100vw-3rem)] space-y-3 rounded-xl border border-border bg-surface p-4 shadow-menu">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text">Filtros</span>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  aria-label="Fechar filtros"
                  className="rounded-full p-1 text-text-muted hover:bg-surface-2 hover:text-text"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-text-muted">Cliente</p>
                <MultiSelect
                  fullWidth
                  options={clients.map((c) => ({ value: c.id, label: c.name }))}
                  value={clientIds}
                  onChange={setClientIds}
                  allLabel="Todos os clientes"
                  pluralLabel="clientes"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-text-muted">Social (solicitante)</p>
                <MultiSelect
                  fullWidth
                  options={members.map((m) => ({ value: m.id, label: m.full_name }))}
                  value={requesterIds}
                  onChange={setRequesterIds}
                  allLabel="Todos os socials"
                  pluralLabel="socials"
                  ariaLabel="Filtrar por social"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-text-muted">Designer (responsável)</p>
                <MultiSelect
                  fullWidth
                  options={members.map((m) => ({ value: m.id, label: m.full_name }))}
                  value={assigneeIds}
                  onChange={setAssigneeIds}
                  allLabel="Todos os responsáveis"
                  pluralLabel="responsáveis"
                  ariaLabel="Filtrar por responsável"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-text-muted">Etiqueta</p>
                <MultiSelect
                  fullWidth
                  options={tags.map((t) => ({ value: t.id, label: t.name }))}
                  value={tagIds}
                  onChange={setTagIds}
                  allLabel="Todas as etiquetas"
                  pluralLabel="etiquetas"
                  ariaLabel="Filtrar por etiqueta"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-text-muted">Prazo</p>
                <select
                  value={deadlineFilter}
                  onChange={(e) => setDeadlineFilter(e.target.value as "" | "atrasados" | "vencem")}
                  className="glass-input w-full rounded-lg px-3 py-2 text-sm outline-none"
                  aria-label="Filtrar por prazo"
                >
                  <option value="">Todos os prazos</option>
                  <option value="atrasados">Atrasados</option>
                  <option value="vencem">Vencem hoje ou amanhã</option>
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-text-muted">Mês</p>
                <div className="flex items-center gap-2">
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="glass-input flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                  />
                  {month && (
                    <button type="button" onClick={() => setMonth("")} className="shrink-0 text-xs text-text-muted hover:text-text">
                      Todos os meses
                    </button>
                  )}
                </div>
              </div>

              {activeFilters > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="w-full rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-muted hover:bg-surface-2 hover:text-text"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={toggleDensity}
          aria-pressed={density === "compact"}
          title={density === "compact" ? "Voltar ao modo confortável (mostra as capas)" : "Deixa os cards menores e esconde as capas"}
          className={`glass-input flex items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none ${
            density === "compact" ? "border-accent-border text-accent" : ""
          }`}
        >
          <Rows3 className="h-4 w-4" />
          Compacto
        </button>
      </div>

      {loading && <TopProgress />}
      {error && <p className="text-sm text-danger">{error}</p>}
      {actionError && <p className="text-sm text-danger">{actionError}</p>}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveEntry(null)}
      >
        {/* Colunas largas (380px) de largura fixa: rola pro lado quando não cabem, nunca pra baixo —
            a altura é a da tela e cada coluna rola por dentro. */}
        <div className="flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden pb-2 sm:snap-none sm:gap-4">
          {CALENDAR_ENTRY_STATUSES.map((status) => (
            <div key={status} className="h-full w-[calc(100vw-3.5rem)] max-w-[380px] shrink-0 snap-start sm:w-[380px]">
              <KanbanColumn
                status={status}
                entries={visibleEntries.filter((e) => e.status === status)}
                clients={clients}
                members={members}
                canEdit={canEdit}
                onSelect={setSelected}
                instagramByEntry={instagramByEntry}
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
          clientId={clientIds[0] ?? clients[0].id}
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
          clients={clients}
          defaultDate={selected.scheduled_date}
          entry={selected}
          canDelete={canDelete}
          onCreate={create}
          onUpdate={update}
          instagram={{ canView: canViewInstagram, canManage: canManageInstagram, onChanged: refreshInstagram }}
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
