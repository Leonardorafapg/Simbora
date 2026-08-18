import { useDroppable } from "@dnd-kit/core";
import type { Demand, DemandStatus } from "@/types/demand";
import { DEMAND_STATUS_LABELS } from "@/types/demand";
import type { Client } from "@/types/client";
import type { TeamMember } from "@/types/team";
import DemandCard from "./DemandCard";

type Props = {
  status: DemandStatus;
  demands: Demand[];
  clients: Client[];
  teamMembers: TeamMember[];
  canEdit: boolean;
  onSelect: (demand: Demand) => void;
  onChangeStatus: (demand: Demand, status: DemandStatus) => void;
};

export default function KanbanColumn({ status, demands, clients, teamMembers, canEdit, onSelect, onChangeStatus }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`glass-card rounded-2xl p-3 space-y-2 min-h-[140px] transition-colors ${
        isOver ? "ring-2 ring-cyan/50 bg-cyan/5" : ""
      }`}
    >
      <div className="flex items-center justify-between px-1">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">
          {DEMAND_STATUS_LABELS[status]}
        </h4>
        <span className="text-xs text-white/30">{demands.length}</span>
      </div>

      <div className="space-y-2">
        {demands.map((demand) => (
          <DemandCard
            key={demand.id}
            demand={demand}
            client={clients.find((c) => c.id === demand.client_id)}
            assignee={teamMembers.find((m) => m.id === demand.assignee_id)}
            canEdit={canEdit}
            onSelect={onSelect}
            onChangeStatus={onChangeStatus}
          />
        ))}
      </div>
    </div>
  );
}
