import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import type { CalendarEntry } from "@/types/calendar";
import { MONTH_LABELS } from "@/types/calendar";
import { todayLocalISO } from "@/lib/format";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Props = {
  year: number;
  month: number; // 1-12
  entries: CalendarEntry[];
  canCreate: boolean;
  canEdit: boolean;
  onCreateDate: (date: string) => void;
  onEditEntry: (entry: CalendarEntry) => void;
  onChangeMonth: (year: number, month: number) => void;
  onOpenReport: () => void;
  /** Só visualização: esconde a navegação de mês e o botão de relatório. */
  readOnly?: boolean;
  /** Células mais baixas (ex.: tela de aprovações). */
  compact?: boolean;
};

function toISODate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function CalendarMonthView({
  year,
  month,
  entries,
  canCreate,
  canEdit,
  onCreateDate,
  onEditEntry,
  onChangeMonth,
  onOpenReport,
  readOnly = false,
  compact = false,
}: Props) {
  const cellH = compact ? "min-h-[44px]" : "min-h-[64px] sm:min-h-[92px]";
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = firstOfMonth.getDay(); // 0 = domingo

  const entriesByDate = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    const list = entriesByDate.get(entry.scheduled_date) ?? [];
    list.push(entry);
    entriesByDate.set(entry.scheduled_date, list);
  }

  const todayISO = todayLocalISO();

  const cells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function shift(delta: number) {
    const date = new Date(year, month - 1 + delta, 1);
    onChangeMonth(date.getFullYear(), date.getMonth() + 1);
  }

  return (
    <div className="glass-card rounded-2xl p-3 sm:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div>
          <h3 className="font-semibold text-text">Calendário de Postagem</h3>
          <p className="text-xs uppercase tracking-wider text-text-faint mt-0.5">
            {MONTH_LABELS[month - 1]} {year}
          </p>
        </div>

        <div className={`flex items-center gap-2 ${readOnly ? "hidden" : ""}`}>
          <button
            type="button"
            onClick={onOpenReport}
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-semibold text-text hover:border-border-hover flex items-center gap-1.5"
          >
            <FileText className="h-3.5 w-3.5" /> Relatório
          </button>
          <button
            type="button"
            onClick={() => shift(-1)}
            className="rounded-lg border border-border bg-surface-2 p-2 text-text-muted hover:text-text hover:border-border-hover"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            className="rounded-lg border border-border bg-surface-2 p-2 text-text-muted hover:text-text hover:border-border-hover"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="text-center text-[11px] uppercase tracking-wider text-text-faint py-2"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (day === null) {
              return (
                <div
                  key={`empty-${i}`}
                  className={`border-r border-b border-border ${cellH}`}
                />
              );
            }

            const dateISO = toISODate(year, month, day);
            const dayEntries = entriesByDate.get(dateISO) ?? [];
            const isToday = dateISO === todayISO;
            const visibleEntries = dayEntries.slice(0, 2);

            return (
              <div
                key={dateISO}
                role={canCreate ? "button" : undefined}
                tabIndex={canCreate ? 0 : undefined}
                onClick={() => canCreate && onCreateDate(dateISO)}
                onKeyDown={(e) => {
                  if (canCreate && (e.key === "Enter" || e.key === " "))
                    onCreateDate(dateISO);
                }}
                className={`${cellH} p-1 sm:p-2 flex flex-col items-start gap-1 text-left border-r border-b border-border transition-colors ${
                  canCreate ? "cursor-pointer hover:bg-surface-2" : ""
                }`}
              >
                <span
                  className={`text-sm ${isToday ? "font-bold text-cyan" : "text-text"}`}
                >
                  {day}
                </span>

                <div className="flex flex-col gap-1 w-full">
                  {visibleEntries.map((entry) => {
                    const chipContent = (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-cyan/60" />
                        <span className="text-[10px] text-text-muted truncate">{entry.title || entry.theme}</span>
                      </>
                    );

                    return canEdit ? (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditEntry(entry);
                        }}
                        className="flex items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-surface-2 w-full min-w-0"
                      >
                        {chipContent}
                      </button>
                    ) : (
                      <div key={entry.id} className="flex items-center gap-1 px-1 py-0.5 w-full min-w-0">
                        {chipContent}
                      </div>
                    );
                  })}
                  {dayEntries.length > visibleEntries.length && (
                    <span className="text-[9px] text-text-faint px-1">
                      +{dayEntries.length - visibleEntries.length}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
