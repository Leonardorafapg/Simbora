"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Table2 } from "lucide-react";
import { useCalendarEntries } from "@/hooks/useCalendarEntries";
import CalendarMonthView from "@/components/calendar/CalendarMonthView";
import CalendarReport from "@/components/calendar/CalendarReport";
import Skeleton from "@/components/ui/Skeleton";
import type { CalendarPeriodPending } from "@/types/calendarPeriod";

type View = "calendario" | "tabela";

/**
 * Cronograma do mês que está sendo aprovado, só para leitura, em dois formatos:
 * calendário (visão do mês) e tabela (o mesmo layout do relatório que vai no PDF).
 */
export default function ApprovalSchedule({ item, monthLabel }: { item: CalendarPeriodPending; monthLabel: string }) {
  const monthStr = `${item.year}-${String(item.month).padStart(2, "0")}`;
  const { entries, loading, error } = useCalendarEntries(item.client_id, monthStr);
  const [view, setView] = useState<View>("tabela");
  const [expanded, setExpanded] = useState(false);

  const tab = (value: View, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => setView(value)}
      aria-pressed={view === value}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
        view === value ? "bg-accent-soft text-accent" : "text-text-muted hover:bg-surface-2 hover:text-text"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-2/40 p-1">
          {tab("tabela", "Tabela (igual ao PDF)", <Table2 className="h-3.5 w-3.5" />)}
          {tab("calendario", "Calendário", <CalendarDays className="h-3.5 w-3.5" />)}
        </div>
        {!loading && (
          <span className="text-xs text-text-faint">
            {entries.length} {entries.length === 1 ? "postagem" : "postagens"} em {monthLabel}
          </span>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className={`overflow-y-auto rounded-xl transition-[max-height] duration-300 ${expanded ? "max-h-[80vh]" : "max-h-[300px]"}`}>
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : view === "calendario" ? (
          <CalendarMonthView
            readOnly
            compact
            year={item.year}
            month={item.month}
            entries={entries}
            canCreate={false}
            canEdit={false}
            onCreateDate={() => {}}
            onEditEntry={() => {}}
            onChangeMonth={() => {}}
            onOpenReport={() => setView("tabela")}
          />
        ) : (
          <CalendarReport
            compact
            clientName={item.client_name}
            monthLabel={monthLabel}
            entries={entries}
            onClose={() => setView("calendario")}
          />
        )}
      </div>
      {!loading && entries.length > 4 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mx-auto flex items-center gap-1 text-xs font-semibold text-text-muted transition-colors hover:text-text"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? "Mostrar menos" : "Ver tudo"}
        </button>
      )}
    </div>
  );
}
