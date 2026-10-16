import { useDroppable } from "@dnd-kit/core";
import type { CalendarEntry, CalendarEntryStatus } from "@/types/calendar";
import { CALENDAR_ENTRY_STATUS_LABELS } from "@/types/calendar";
import type { Client } from "@/types/client";
import PostCard from "./PostCard";

type Props = {
  status: CalendarEntryStatus;
  entries: CalendarEntry[];
  clients: Client[];
  canEdit: boolean;
  onSelect: (entry: CalendarEntry) => void;
};

export default function KanbanColumn({ status, entries, clients, canEdit, onSelect }: Props) {
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
          {CALENDAR_ENTRY_STATUS_LABELS[status]}
        </h4>
        <span className="text-xs text-white/30">{entries.length}</span>
      </div>

      <div className="space-y-2">
        {entries.map((entry) => (
          <PostCard
            key={entry.id}
            entry={entry}
            client={clients.find((c) => c.id === entry.client_id)}
            canEdit={canEdit}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
