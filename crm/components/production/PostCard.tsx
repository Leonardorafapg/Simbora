import { useDraggable } from "@dnd-kit/core";
import type { CalendarEntry } from "@/types/calendar";
import type { Client } from "@/types/client";
import { formatDate } from "@/lib/format";

type Props = {
  entry: CalendarEntry;
  client?: Client;
  canEdit: boolean;
  onSelect: (entry: CalendarEntry) => void;
};

export default function PostCard({ entry, client, canEdit, onSelect }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `post-${entry.id}`,
    data: { entry },
    disabled: !canEdit,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 20 }
    : undefined;

  const overdue = entry.status !== "finalizados" && entry.scheduled_date < new Date().toISOString().slice(0, 10);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-white/10 bg-white/5 p-3 ${isDragging ? "opacity-40" : ""}`}
    >
      <div
        {...(canEdit ? { ...attributes, ...listeners } : {})}
        className={canEdit ? "cursor-grab active:cursor-grabbing" : ""}
      >
        <button type="button" onClick={() => onSelect(entry)} className="text-left w-full">
          <p className="text-sm text-white line-clamp-2">{entry.title || entry.theme}</p>
          {client && <p className="text-xs text-cyan truncate mt-0.5">{client.name}</p>}
          <span
            className={`inline-block mt-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              overdue ? "bg-danger/15 text-danger" : "bg-white/10 text-white/60"
            }`}
          >
            {formatDate(entry.scheduled_date)}
          </span>
        </button>
      </div>
    </div>
  );
}
