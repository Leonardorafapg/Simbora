"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTH_FULL = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

type Props = {
  from: string | undefined;
  to: string | undefined;
  onChange: (from: string | undefined, to: string | undefined) => void;
  placeholder?: string;
};

function toISO(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseISO(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

function formatLabel(iso: string) {
  const { year, month, day } = parseISO(iso);
  return `${day} de ${MONTH_ABBR[month - 1]} de ${year}`;
}

/** Semana começa na segunda — `getDay()` do JS começa no domingo (0). */
function mondayFirstWeekday(date: Date) {
  return (date.getDay() + 6) % 7;
}

function buildCells(year: number, month: number) {
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startOffset = mondayFirstWeekday(firstOfMonth);

  const cells: (number | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

type MonthCalendarProps = {
  year: number;
  month: number;
  from: string | undefined;
  to: string | undefined;
  hoverEnd: string | null;
  onSelectDay: (iso: string) => void;
  onHoverDay: (iso: string | null) => void;
  onSelectMonth: (month: number) => void;
  onSelectYear: (year: number) => void;
};

function MonthCalendar({
  year,
  month,
  from,
  to,
  hoverEnd,
  onSelectDay,
  onHoverDay,
  onSelectMonth,
  onSelectYear,
}: MonthCalendarProps) {
  const cells = buildCells(year, month);
  const todayISO = new Date().toISOString().slice(0, 10);
  const rangeEnd = to ?? hoverEnd ?? undefined;

  return (
    <div className="w-64">
      <div className="flex items-center gap-2 mb-3">
        <div className="relative">
          <select
            value={month}
            onChange={(e) => onSelectMonth(Number(e.target.value))}
            className="glass-input appearance-none rounded-md pl-2 pr-6 py-1 text-sm outline-none cursor-pointer"
          >
            {MONTH_FULL.map((label, idx) => (
              <option key={label} value={idx + 1}>
                {label.slice(0, 3)}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/40" />
        </div>
        <div className="relative">
          <select
            value={year}
            onChange={(e) => onSelectYear(Number(e.target.value))}
            className="glass-input appearance-none rounded-md pl-2 pr-6 py-1 text-sm outline-none cursor-pointer"
          >
            {Array.from({ length: 11 }, (_, i) => year - 5 + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/40" />
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-xs text-white/40 py-1">
            {w}
          </span>
        ))}

        {cells.map((day, idx) => {
          if (day === null) return <span key={idx} />;

          const iso = toISO(year, month, day);
          const isStart = iso === from;
          const isEnd = iso === to;
          const isBetween = !!from && !!rangeEnd && iso > from && iso < rangeEnd;
          const isEdge = isStart || isEnd;
          const isToday = iso === todayISO;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectDay(iso)}
              onMouseEnter={() => onHoverDay(iso)}
              className={`h-8 w-8 mx-auto flex items-center justify-center text-sm rounded-full transition
                ${isEdge ? "bg-cyan text-black font-semibold" : ""}
                ${isBetween ? "bg-cyan/15 text-white rounded-none" : ""}
                ${!isEdge && !isBetween ? "text-white/80 hover:bg-white/10" : ""}
                ${isToday && !isEdge ? "ring-1 ring-cyan/60" : ""}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DateRangePicker({ from, to, onChange, placeholder = "Período" }: Props) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hoverEnd, setHoverEnd] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const initial = from ? parseISO(from) : { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  const [leftMonth, setLeftMonth] = useState({ year: initial.year, month: initial.month });
  const right = shiftMonth(leftMonth.year, leftMonth.month, 1);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelectDay(iso: string) {
    if (!anchor) {
      setAnchor(iso);
      onChange(iso, undefined);
      return;
    }

    if (iso < anchor) {
      onChange(iso, anchor);
    } else {
      onChange(anchor, iso);
    }
    setAnchor(null);
    setHoverEnd(null);
    setOpen(false);
  }

  function handleClear() {
    onChange(undefined, undefined);
    setAnchor(null);
    setHoverEnd(null);
  }

  function setSideMonth(side: "left" | "right", year: number, month: number) {
    setLeftMonth(side === "left" ? { year, month } : shiftMonth(year, month, -1));
  }

  const label = from && to ? `${formatLabel(from)} a ${formatLabel(to)}` : from ? `A partir de ${formatLabel(from)}` : placeholder;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="glass-input flex items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none whitespace-nowrap"
      >
        <CalendarDays className="h-4 w-4 text-white/40 shrink-0" />
        <span className={from ? "text-white" : "text-white/40"}>{label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-white/40 shrink-0" />
      </button>

      {open && (
        <div className="glass-modal absolute left-0 top-full mt-2 rounded-xl p-4 z-50 flex items-start gap-4 w-max">
          <button
            type="button"
            onClick={() => setLeftMonth((m) => shiftMonth(m.year, m.month, -1))}
            className="mt-8 shrink-0 h-7 w-7 flex items-center justify-center rounded-md text-white/50 hover:text-white hover:bg-white/10"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <MonthCalendar
            year={leftMonth.year}
            month={leftMonth.month}
            from={from}
            to={to}
            hoverEnd={hoverEnd}
            onSelectDay={handleSelectDay}
            onHoverDay={setHoverEnd}
            onSelectMonth={(month) => setSideMonth("left", leftMonth.year, month)}
            onSelectYear={(year) => setSideMonth("left", year, leftMonth.month)}
          />

          <div className="w-px self-stretch bg-white/10" />

          <MonthCalendar
            year={right.year}
            month={right.month}
            from={from}
            to={to}
            hoverEnd={hoverEnd}
            onSelectDay={handleSelectDay}
            onHoverDay={setHoverEnd}
            onSelectMonth={(month) => setSideMonth("right", right.year, month)}
            onSelectYear={(year) => setSideMonth("right", year, right.month)}
          />

          <button
            type="button"
            onClick={() => setLeftMonth((m) => shiftMonth(m.year, m.month, 1))}
            className="mt-8 shrink-0 h-7 w-7 flex items-center justify-center rounded-md text-white/50 hover:text-white hover:bg-white/10"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {(from || to) && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 bottom-3 text-xs text-white/40 hover:text-white transition"
            >
              Limpar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
