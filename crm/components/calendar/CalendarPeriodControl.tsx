import { CALENDAR_PERIOD_STATUSES, CALENDAR_PERIOD_STATUS_COLORS, CALENDAR_PERIOD_STATUS_LABELS } from "@/types/calendarPeriod";
import type { CalendarPeriodStatus } from "@/types/calendarPeriod";

type Props = {
  status: CalendarPeriodStatus;
  canManage: boolean;
  saving: boolean;
  onChange: (status: CalendarPeriodStatus) => void;
};

/**
 * Status do cronograma do mês inteiro (cliente + mês), não de uma postagem
 * isolada. É informativo: não bloqueia criar, editar ou remover postagens. O
 * seletor permite ir pra qualquer status livremente.
 */
export default function CalendarPeriodControl({ status, canManage, saving, onChange }: Props) {
  return (
    <div className="glass-card rounded-2xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${CALENDAR_PERIOD_STATUS_COLORS[status]}`}>
          {CALENDAR_PERIOD_STATUS_LABELS[status]}
        </span>
      </div>

      {canManage && (
        <select
          value={status}
          disabled={saving}
          onChange={(e) => onChange(e.target.value as CalendarPeriodStatus)}
          className="glass-input rounded-lg px-3 py-2 text-xs font-semibold outline-none disabled:opacity-60"
        >
          {CALENDAR_PERIOD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CALENDAR_PERIOD_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
