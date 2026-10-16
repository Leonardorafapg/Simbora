import { useDraggable } from "@dnd-kit/core";
import type { CalendarEntry } from "@/types/calendar";
import type { Client } from "@/types/client";
import { formatDate } from "@/lib/format";
import { DEADLINE_CLASSES, DEADLINE_LABELS, deadlineInfo, formatDeadline } from "@/lib/deadline";
import { tagChipClass } from "@/lib/tagColors";

type ContentProps = {
  entry: CalendarEntry;
  client?: Client;
  onSelect?: (entry: CalendarEntry) => void;
};

function PostCardContent({ entry, client, onSelect }: ContentProps) {
  const deadline = deadlineInfo(entry);

  return (
    <button type="button" onClick={() => onSelect?.(entry)} className="text-left w-full">
      {entry.tags.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {entry.tags.map((tag) => (
            <span
              key={tag.id}
              title={tag.name}
              className={`max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${tagChipClass(tag.color)}`}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
      <p className="text-sm text-white line-clamp-2">{entry.title || entry.theme}</p>
      {client && <p className="text-xs text-cyan truncate mt-0.5">{client.name}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/60">
          Post {formatDate(entry.scheduled_date)}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${DEADLINE_CLASSES[deadline.state]}`}
          title={`Entregar até ${formatDeadline(deadline.deadline)}`}
        >
          {deadline.state === "atrasado"
            ? `Atrasado ${deadline.daysLate}d`
            : deadline.state === "entregue_atrasado"
              ? `Entregue +${deadline.daysLate}d`
              : deadline.state === "entregue_no_prazo"
                ? "Entregue"
                : deadline.state === "no_prazo"
                  ? `Entregar até ${formatDeadline(deadline.deadline)}`
                  : DEADLINE_LABELS[deadline.state]}
        </span>
      </div>
    </button>
  );
}

type Props = {
  entry: CalendarEntry;
  client?: Client;
  canEdit: boolean;
  onSelect: (entry: CalendarEntry) => void;
};

export default function PostCard({ entry, client, canEdit, onSelect }: Props) {
  // O movimento durante o arraste é do DragOverlay (a coluna tem overflow, que
  // cortaria o card): aqui o original só fica esmaecido no lugar.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `post-${entry.id}`,
    data: { entry },
    disabled: !canEdit,
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border border-white/10 bg-white/5 p-3 ${isDragging ? "opacity-40" : ""}`}
    >
      <div
        {...(canEdit ? { ...attributes, ...listeners } : {})}
        className={canEdit ? "cursor-grab active:cursor-grabbing" : ""}
      >
        <PostCardContent entry={entry} client={client} onSelect={onSelect} />
      </div>
    </div>
  );
}

/** Cartão que acompanha o ponteiro durante o arraste (renderizado no DragOverlay). */
export function PostCardOverlay({ entry, client }: { entry: CalendarEntry; client?: Client }) {
  return (
    <div className="cursor-grabbing rounded-xl border border-cyan/40 bg-[#26272b] p-3 shadow-2xl">
      <PostCardContent entry={entry} client={client} />
    </div>
  );
}
