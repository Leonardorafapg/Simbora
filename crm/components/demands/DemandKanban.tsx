import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { Demand, DemandStatus } from "@/types/demand";
import { DEMAND_STATUSES } from "@/types/demand";
import type { Client } from "@/types/client";
import type { TeamMember } from "@/types/team";
import KanbanColumn from "./KanbanColumn";

type Props = {
  demands: Demand[];
  clients: Client[];
  teamMembers: TeamMember[];
  canEdit: boolean;
  onSelect: (demand: Demand) => void;
  onChangeStatus: (demand: Demand, status: DemandStatus) => void;
};

export default function DemandKanban({ demands, clients, teamMembers, canEdit, onSelect, onChangeStatus }: Props) {
  // Distância mínima antes de considerar "arrastando" — sem isso, todo
  // clique no card (pra abrir o dialog) seria capturado como um drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const demand = active.data.current?.demand as Demand | undefined;
    const targetStatus = over.id as DemandStatus;
    if (!demand || demand.status === targetStatus) return;

    onChangeStatus(demand, targetStatus);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-start">
        {DEMAND_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            demands={demands.filter((d) => d.status === status)}
            clients={clients}
            teamMembers={teamMembers}
            canEdit={canEdit}
            onSelect={onSelect}
            onChangeStatus={onChangeStatus}
          />
        ))}
      </div>
    </DndContext>
  );
}
