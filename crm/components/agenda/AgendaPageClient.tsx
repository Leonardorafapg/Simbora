"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, FileDown, Plus } from "lucide-react";
import { dayKey, eventsByDay, formatEventRange, monthCells } from "@/lib/agenda";
import { todayLocalISO } from "@/lib/format";
import { MONTH_LABELS } from "@/types/calendar";
import { useAgenda } from "@/hooks/useAgenda";
import { useTeamDirectory } from "@/hooks/useTeamDirectory";
import { fetchAgendaEvent, fetchAgendaEvents } from "@/services/client/agendaApi";
import { buildWeekGrid, weekStartOf, weekWindow } from "@/lib/agendaWeek";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import AgendaEventDialog from "@/components/agenda/AgendaEventDialog";
import type { AgendaEvent } from "@/types/agenda";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const iso = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

type Props = { currentUserId: number | null; canEditOthers: boolean };

export default function AgendaPageClient({ currentUserId, canEditOthers }: Props) {
  const today = todayLocalISO();
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)));
  const [selectedDay, setSelectedDay] = useState(today);
  const [dialog, setDialog] = useState<{ event: AgendaEvent | null } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { events, loading, error, create, update, remove } = useAgenda(year, month);
  const { members } = useTeamDirectory();
  const searchParams = useSearchParams();

  const byDay = useMemo(() => eventsByDay(events), [events]);
  const cells = useMemo(() => monthCells(year, month), [year, month]);
  const dayEvents = byDay.get(selectedDay) ?? [];

  // Link de um aviso (/agenda?evento=7): abre o compromisso, indo pro mês dele.
  const requestedId = Number(searchParams.get("evento")) || null;
  useEffect(() => {
    if (!requestedId) return;
    let cancelled = false;
    (async () => {
      try {
        const event = await fetchAgendaEvent(requestedId);
        if (cancelled) return;
        const start = new Date(event.starts_at);
        setYear(start.getFullYear());
        setMonth(start.getMonth() + 1);
        setSelectedDay(dayKey(start));
        setDialog({ event });
        setLinkError(null);
      } catch (err) {
        if (!cancelled) setLinkError(err instanceof Error ? err.message : "Compromisso não encontrado.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestedId]);

  function changeMonth(delta: number) {
    const next = new Date(year, month - 1 + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
  }

  // PDF da semana do dia selecionado (segunda a domingo), no modelo da agenda impressa da Simbora.
  async function exportWeek() {
    setExporting(true);
    setExportError(null);
    try {
      const weekStart = weekStartOf(selectedDay);
      const { start, end } = weekWindow(weekStart);
      // Busca a semana inteira (ela pode atravessar dois meses; a tela só carrega o mês aberto).
      const weekEvents = await fetchAgendaEvents(start, end);
      const { exportAgendaToPdf } = await import("@/lib/agendaPdf");
      await exportAgendaToPdf(buildWeekGrid(weekEvents, weekStart));
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Não foi possível gerar o PDF.");
    } finally {
      setExporting(false);
    }
  }

  function goToday() {
    setYear(Number(today.slice(0, 4)));
    setMonth(Number(today.slice(5, 7)));
    setSelectedDay(today);
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-8">
      <PageHeader
        title="Agenda"
        description="Compromissos da equipe. Quem participa é avisado quando você marca, altera ou cancela."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={exportWeek}
              disabled={exporting}
              title="Baixa a semana do dia selecionado (segunda a domingo) em PDF"
            >
              <FileDown className="h-4 w-4" />
              {exporting ? "Gerando..." : "Exportar semana (PDF)"}
            </Button>
            <Button onClick={() => setDialog({ event: null })}>
              <Plus className="h-4 w-4" />
              Novo compromisso
            </Button>
          </>
        }
      />

      {(error || linkError || exportError) && <p className="mb-4 text-sm text-danger">{error ?? linkError ?? exportError}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="glass-card rounded-2xl p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-text">
              {MONTH_LABELS[month - 1]} {year}
            </h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={goToday}>
                Hoje
              </Button>
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                aria-label="Mês anterior"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                aria-label="Próximo mês"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px text-center text-[11px] font-medium text-text-faint">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className={`grid grid-cols-7 gap-1 ${loading ? "opacity-60" : ""}`}>
            {cells.map((day, i) => {
              if (day === null) return <div key={`blank-${i}`} className="min-h-[56px] sm:min-h-[84px]" />;
              const key = iso(year, month, day);
              const list = byDay.get(key) ?? [];
              const selected = key === selectedDay;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(key)}
                  onDoubleClick={() => {
                    setSelectedDay(key);
                    setDialog({ event: null });
                  }}
                  aria-label={`${day} de ${MONTH_LABELS[month - 1]}${list.length ? `, ${list.length} compromisso${list.length > 1 ? "s" : ""}` : ""}`}
                  aria-pressed={selected}
                  className={`flex min-h-[56px] flex-col items-start gap-0.5 rounded-lg border p-1 text-left transition-colors sm:min-h-[84px] sm:p-1.5 ${
                    selected ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2"
                  }`}
                >
                  <span
                    className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs ${
                      key === today ? "bg-cyan font-bold text-black" : "text-text"
                    }`}
                  >
                    {day}
                  </span>
                  {list.slice(0, 2).map((event) => (
                    <span key={event.id} className="hidden w-full truncate rounded bg-accent-soft px-1 text-[10px] text-accent sm:block">
                      {event.title}
                    </span>
                  ))}
                  {list.length > 0 && (
                    <span className="text-[10px] text-text-faint sm:hidden">{list.length} •</span>
                  )}
                  {list.length > 2 && <span className="hidden text-[10px] text-text-faint sm:block">+{list.length - 2}</span>}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="glass-card h-fit rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-text">
            {new Date(`${selectedDay}T12:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </h2>

          {dayEvents.length === 0 ? (
            <p className="mt-3 text-sm text-text-faint">Nada marcado nesse dia.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {dayEvents.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => setDialog({ event })}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-left transition-colors hover:border-accent-border"
                  >
                    <span className="block text-xs font-medium text-accent">{formatEventRange(event)}</span>
                    <span className="block truncate text-sm font-medium text-text">{event.title}</span>
                    {event.participants.length > 0 && (
                      <span className="block truncate text-xs text-text-faint">
                        {event.participants.map((p) => p.full_name.split(" ")[0]).join(", ")}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={() => setDialog({ event: null })}>
            <Plus className="h-3.5 w-3.5" />
            Marcar neste dia
          </Button>
        </aside>
      </div>

      {dialog && (
        <AgendaEventDialog
          key={dialog.event?.id ?? `new-${selectedDay}`}
          event={dialog.event}
          initialDate={selectedDay}
          currentUserId={currentUserId}
          canEditOthers={canEditOthers}
          members={members}
          onSave={(input) => (dialog.event ? update(dialog.event.id, input) : create(input))}
          onDelete={() => remove(dialog.event!.id)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
