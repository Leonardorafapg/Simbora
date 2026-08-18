import { ImageOff, ListChecks } from "lucide-react";
import type { Demand } from "@/types/demand";
import { DEMAND_STATUS_COLORS, DEMAND_STATUS_LABELS, SITUACAO_COLORS, checklistProgress, getDemandSituacao } from "@/types/demand";
import type { Client } from "@/types/client";
import type { TeamMember } from "@/types/team";
import { formatDate } from "@/lib/format";

type Props = {
  demands: Demand[];
  clients: Client[];
  teamMembers: TeamMember[];
  onSelect: (demand: Demand) => void;
};

export default function DemandTable({ demands, clients, teamMembers, onSelect }: Props) {
  const clientName = (id: number | null) => clients.find((c) => c.id === id)?.name ?? "—";
  const memberName = (id: number | null) => teamMembers.find((m) => m.id === id)?.full_name ?? "—";

  if (demands.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center text-sm text-white/50">
        Nenhuma demanda encontrada com esses filtros.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden overflow-x-auto glass-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/5 text-left text-[11px] uppercase tracking-wider text-white/40">
            <th className="px-4 py-3 font-medium">Tarefa</th>
            <th className="px-4 py-3 font-medium">Cliente</th>
            <th className="px-4 py-3 font-medium">Prazo</th>
            <th className="px-4 py-3 font-medium">Solicitante</th>
            <th className="px-4 py-3 font-medium">Responsável</th>
            <th className="px-4 py-3 font-medium">Situação</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {demands.map((demand) => {
            const progress = checklistProgress(demand);
            const situacao = getDemandSituacao(demand);

            return (
              <tr
                key={demand.id}
                onClick={() => onSelect(demand)}
                className="border-t border-white/5 cursor-pointer hover:bg-white/5"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 max-w-[280px]">
                    <span className="text-white truncate">{demand.title}</span>
                    {progress.total > 0 && (
                      <span className="shrink-0 flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/60">
                        <ListChecks className="h-3 w-3" />
                        {progress.done}/{progress.total}
                      </span>
                    )}
                    {demand.is_art && !demand.has_material && (
                      <span
                        className="shrink-0 flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-400"
                        title="Precisa captar material"
                      >
                        <ImageOff className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-white/70">{clientName(demand.client_id)}</td>
                <td className="px-4 py-3 text-white/70 whitespace-nowrap">
                  {demand.due_date ? formatDate(demand.due_date) : "—"}
                </td>
                <td className="px-4 py-3 text-white/70">{memberName(demand.requester_id)}</td>
                <td className="px-4 py-3 text-white/70">{memberName(demand.assignee_id)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${SITUACAO_COLORS[situacao.general]}`}>
                    {situacao.general === "Atrasada" || situacao.general === "No prazo" ? situacao.specific : situacao.general}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${DEMAND_STATUS_COLORS[demand.status]}`}>
                    {DEMAND_STATUS_LABELS[demand.status]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
