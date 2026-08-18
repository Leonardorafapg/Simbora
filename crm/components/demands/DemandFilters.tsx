import { LayoutGrid, List } from "lucide-react";
import type { Client } from "@/types/client";
import type { TeamMember } from "@/types/team";
import type { DemandFilters as Filters, DemandStatus } from "@/types/demand";
import { DEMAND_STATUSES, DEMAND_STATUS_LABELS } from "@/types/demand";
import DateRangePicker from "@/components/ui/DateRangePicker";

type View = "tabela" | "kanban";

type Props = {
  filters: Filters;
  onChangeFilters: (filters: Filters) => void;
  clients: Client[];
  teamMembers: TeamMember[];
  view: View;
  onChangeView: (view: View) => void;
  canCreate: boolean;
  onAddClick: () => void;
};

export default function DemandFilters({
  filters,
  onChangeFilters,
  clients,
  teamMembers,
  view,
  onChangeView,
  canCreate,
  onAddClick,
}: Props) {
  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    onChangeFilters({ ...filters, [key]: value || undefined });
  }

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filters.client_id ?? ""}
          onChange={(e) => update("client_id", e.target.value ? Number(e.target.value) : undefined)}
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
          value={filters.unassigned ? "unassigned" : (filters.assignee_id ?? "")}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "unassigned") {
              onChangeFilters({ ...filters, assignee_id: undefined, unassigned: true });
            } else {
              onChangeFilters({ ...filters, unassigned: undefined, assignee_id: raw ? Number(raw) : undefined });
            }
          }}
          className="glass-input rounded-lg px-3 py-2 text-sm outline-none"
        >
          <option value="">Todos os responsáveis</option>
          <option value="unassigned">Sem responsável</option>
          {teamMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name}
            </option>
          ))}
        </select>

        <select
          value={filters.status ?? ""}
          onChange={(e) => update("status", (e.target.value || undefined) as DemandStatus | undefined)}
          className="glass-input rounded-lg px-3 py-2 text-sm outline-none"
        >
          <option value="">Todos os status</option>
          {DEMAND_STATUSES.map((s) => (
            <option key={s} value={s}>
              {DEMAND_STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        <DateRangePicker
          from={filters.date_from}
          to={filters.date_to}
          onChange={(from, to) => onChangeFilters({ ...filters, date_from: from, date_to: to })}
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-white/10 overflow-hidden">
          <button
            type="button"
            onClick={() => onChangeView("tabela")}
            aria-label="Visualização em tabela"
            className={`p-2 ${view === "tabela" ? "bg-cyan/15 text-cyan" : "bg-white/5 text-white/50 hover:text-white"}`}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onChangeView("kanban")}
            aria-label="Visualização em quadro"
            className={`p-2 ${view === "kanban" ? "bg-cyan/15 text-cyan" : "bg-white/5 text-white/50 hover:text-white"}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={onAddClick}
            className="rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-dark"
          >
            + Nova demanda
          </button>
        )}
      </div>
    </div>
  );
}
