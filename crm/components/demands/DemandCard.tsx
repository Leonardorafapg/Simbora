import { useDraggable } from "@dnd-kit/core";
import { ImageOff, ListChecks } from "lucide-react";
import type { Demand, DemandStatus } from "@/types/demand";
import { SITUACAO_COLORS, checklistProgress, getDemandSituacao } from "@/types/demand";
import type { Client } from "@/types/client";
import type { TeamMember } from "@/types/team";
import { formatDate } from "@/lib/format";

type Action = { label: string; target: DemandStatus; tone?: "danger" };

/**
 * Ações por status — não é uma linha reta (pendente→...→concluída): "em
 * aprovação" bifurca em aprovar (concluída) ou reprovar (volta pro
 * andamento), então setinhas genéricas ◀▶ davam a entender que reprovar
 * "avança" rumo a concluída, o que é o oposto do que acontece.
 */
export function actionsFor(demand: Demand): Action[] {
  switch (demand.status) {
    case "pendente":
      return [{ label: "Iniciar", target: "em_andamento" }];
    case "em_andamento":
      return demand.is_art
        ? [{ label: "Enviar p/ aprovação", target: "em_aprovacao" }]
        : [{ label: "Concluir", target: "concluida" }];
    case "em_aprovacao":
      return [
        { label: "Aprovar", target: "concluida" },
        { label: "Reprovar", target: "reprovada", tone: "danger" },
      ];
    case "reprovada":
      return [{ label: "Reiniciar", target: "em_andamento" }];
    case "concluida":
      return [{ label: "Reabrir", target: "em_andamento" }];
    default:
      return [];
  }
}

type Props = {
  demand: Demand;
  client?: Client;
  assignee?: TeamMember;
  canEdit: boolean;
  onSelect: (demand: Demand) => void;
  onChangeStatus: (demand: Demand, status: DemandStatus) => void;
};

export default function DemandCard({ demand, client, assignee, canEdit, onSelect, onChangeStatus }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `demand-${demand.id}`,
    data: { demand },
    disabled: !canEdit,
  });

  const actions = actionsFor(demand);
  const progress = checklistProgress(demand);
  const situacao = getDemandSituacao(demand);

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 20 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-white/10 bg-white/5 p-3 space-y-2 ${isDragging ? "opacity-40" : ""}`}
    >
      <div
        {...(canEdit ? { ...attributes, ...listeners } : {})}
        className={canEdit ? "cursor-grab active:cursor-grabbing" : ""}
      >
        <button type="button" onClick={() => onSelect(demand)} className="text-left w-full">
          <p className="text-sm text-white truncate">{demand.title}</p>
          {client && <p className="text-xs text-cyan truncate mt-0.5">{client.name}</p>}
          <p className="text-xs text-white/40 truncate mt-0.5">
            {assignee?.full_name ?? "Sem responsável"}
          </p>

          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            {demand.due_date && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SITUACAO_COLORS[situacao.general]}`}>
                {formatDate(demand.due_date)}
              </span>
            )}
            {progress.total > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
                <ListChecks className="h-3 w-3" />
                {progress.done}/{progress.total}
              </span>
            )}
            {demand.is_art && !demand.has_material && (
              <span
                className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-400"
                title="Precisa captar material"
              >
                <ImageOff className="h-3 w-3" />
                Sem material
              </span>
            )}
          </div>
        </button>
      </div>

      {canEdit && actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-white/5">
          {actions.map((action) => (
            <button
              key={action.target}
              type="button"
              onClick={() => onChangeStatus(demand, action.target)}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                action.tone === "danger"
                  ? "bg-danger/15 text-danger hover:bg-danger/25"
                  : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
