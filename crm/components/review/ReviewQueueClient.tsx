"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCheck, LayoutGrid, List, Search } from "lucide-react";
import { useReviewQueue } from "@/hooks/useReviewQueue";
import { useClientDirectory } from "@/hooks/useClientDirectory";
import { useTeamDirectory } from "@/hooks/useTeamDirectory";
import { matchesSearch, matchesTab, sortByWaiting, tabCounts, type ReviewTab } from "@/lib/reviewQueue";
import type { CalendarEntry } from "@/types/calendar";
import { TopProgress } from "@/components/ui/Skeleton";
import MultiSelect from "@/components/ui/MultiSelect";
import CalendarEntryDialog from "@/components/calendar/CalendarEntryDialog";
import RejectReasonDialog from "@/components/production/RejectReasonDialog";
import ReviewCard from "./ReviewCard";

type View = "grid" | "list";

const TABS: { id: ReviewTab; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "com_arte", label: "Com arte" },
  { id: "aguardando", label: "Aguardando mídia" },
];

/** Espaço só abre o card quando a pessoa não está digitando nem apertando um botão. */
function isInteractive(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el?.closest("input, textarea, select, button, a, [contenteditable='true'], [role='dialog']");
}

/**
 * Fila da redatora: todos os posts na "Checagem e aprovação", com arte, legenda e anexos à vista.
 * Decide aqui mesmo (aprovar ou pedir ajuste) e abre o briefing completo — a mesma tela dos designers —
 * sem sair da fila.
 */
export default function ReviewQueueClient() {
  const { entries, reviews, loading, error, approve, requestChanges, update } = useReviewQueue();
  const { clients } = useClientDirectory();
  const { members } = useTeamDirectory();
  const highlightedId = Number(useSearchParams().get("demanda")) || null;

  const [tab, setTab] = useState<ReviewTab>("todos");
  const [search, setSearch] = useState("");
  const [clientIds, setClientIds] = useState<number[]>([]);
  const [view, setView] = useState<View>("grid");
  const [openId, setOpenId] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<CalendarEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const hoveredId = useRef<number | null>(null);

  const designerOf = (entry: CalendarEntry) => members.find((m) => m.id === entry.assignee_id);

  // Busca e cliente valem para as abas também: os números das abas refletem o que está filtrado.
  const filtered = useMemo(
    () =>
      entries.filter(
        (entry) =>
          (clientIds.length === 0 || clientIds.includes(entry.client_id)) &&
          matchesSearch(entry, search, {
            client: clients.find((c) => c.id === entry.client_id)?.name,
            designer: members.find((m) => m.id === entry.assignee_id)?.full_name,
          }),
      ),
    [entries, clientIds, search, clients, members],
  );
  const counts = useMemo(() => tabCounts(filtered), [filtered]);
  const visible = useMemo(() => sortByWaiting(filtered.filter((entry) => matchesTab(entry, tab))), [filtered, tab]);

  // Só os clientes que têm post na fila entram no filtro.
  const clientOptions = useMemo(() => {
    const present = new Set(entries.map((e) => e.client_id));
    return clients.filter((c) => present.has(c.id)).map((c) => ({ value: c.id, label: c.name }));
  }, [entries, clients]);

  const opened = entries.find((e) => e.id === openId) ?? null;

  // Espaço sobre um card abre o briefing completo dele.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " || e.repeat || hoveredId.current === null) return;
      if (openId !== null || rejecting !== null || isInteractive(e.target)) return;
      e.preventDefault();
      setOpenId(hoveredId.current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, rejecting]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Não foi possível concluir a revisão.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      {loading && <TopProgress />}

      {/* Fixo só do tablet pra cima: no celular o topo (busca + filtros) ocuparia boa parte da tela. */}
      <div className="z-20 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur md:sticky md:top-0 sm:px-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <CheckCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-2 text-base font-bold text-text">
                Fila de Revisão
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
                  {loading ? "…" : `${entries.length} ${entries.length === 1 ? "pendente" : "pendentes"}`}
                </span>
              </h1>
              <p className="truncate text-xs text-text-muted">Aprove, peça ajustes ou consulte o briefing de cada post.</p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="relative">
              <span className="sr-only">Buscar na fila</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por cliente, título, designer..."
                className="glass-input w-64 rounded-lg py-2 pl-9 pr-3 text-sm outline-none"
              />
            </label>
            <MultiSelect
              options={clientOptions}
              value={clientIds}
              onChange={setClientIds}
              allLabel="Todos os clientes"
              pluralLabel="clientes"
              ariaLabel="Filtrar por cliente"
            />
            <div role="group" aria-label="Modo de exibição" className="flex rounded-lg border border-border bg-surface-2/60 p-0.5">
              {(
                [
                  { id: "grid", label: "Grade", Icon: LayoutGrid },
                  { id: "list", label: "Lista", Icon: List },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  aria-pressed={view === id}
                  title={label}
                  className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                    view === id ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="sr-only">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
                tab === id
                  ? "border-border bg-surface-2 text-text"
                  : "border-transparent text-text-muted hover:text-text"
              }`}
            >
              {label} ({counts[id]})
            </button>
          ))}
          <span className="ml-auto hidden items-center gap-2 text-xs text-text-faint md:flex">
            Pressione
            <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-sans text-[11px] text-text-muted">
              Espaço
            </kbd>
            sobre um card para abrir o briefing completo
          </span>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        {actionError && !rejecting && (
          <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {actionError}
          </p>
        )}

        {!loading && !error && entries.length === 0 && (
          <p className="text-sm text-text-muted">Nenhum post na checagem agora. Tudo revisado.</p>
        )}
        {!loading && entries.length > 0 && visible.length === 0 && (
          <p className="text-sm text-text-muted">Nenhum post encontrado com esses filtros.</p>
        )}

        {/* Colunas conforme a largura (cada card com pelo menos 28rem): 1 no celular, 2 em notebook, 3 em tela grande. */}
        <div
          className={
            view === "grid"
              ? "grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,28rem),1fr))]"
              : "grid gap-3"
          }
        >
          {visible.map((entry) => (
            <ReviewCard
              key={entry.id}
              entry={entry}
              client={clients.find((c) => c.id === entry.client_id)}
              assignee={designerOf(entry)}
              members={members}
              reviews={reviews[entry.id] ?? []}
              highlighted={entry.id === highlightedId}
              busy={busy}
              compact={view === "list"}
              onApprove={() => run(() => approve(entry))}
              onRequestChanges={() => setRejecting(entry)}
              onOpenDetails={() => setOpenId(entry.id)}
              onHoverChange={(hovering) => {
                if (hovering) hoveredId.current = entry.id;
                else if (hoveredId.current === entry.id) hoveredId.current = null;
              }}
            />
          ))}
        </div>
      </div>

      {opened && (
        <CalendarEntryDialog
          open
          onClose={() => setOpenId(null)}
          clientId={opened.client_id}
          clients={clients}
          defaultDate={opened.scheduled_date}
          entry={opened}
          onCreate={async () => {
            throw new Error("Criar post não está disponível na revisão.");
          }}
          onUpdate={update}
          // `instagram` liga a seção "Revisões" do diálogo; sem permissão de ver/gerir, a parte do Instagram fica oculta.
          instagram={{ canView: false, canManage: false }}
        />
      )}

      {rejecting && (
        <RejectReasonDialog
          title={rejecting.title || rejecting.theme}
          loading={busy}
          error={actionError}
          onCancel={() => {
            setRejecting(null);
            setActionError(null);
          }}
          onConfirm={(reason) =>
            run(async () => {
              await requestChanges(rejecting, reason);
              setRejecting(null);
            })
          }
        />
      )}
    </div>
  );
}
