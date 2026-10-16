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
      className={`glass-card flex h-full min-h-0 flex-col gap-2 rounded-2xl p-3 transition-colors ${
        isOver ? "ring-2 ring-cyan/50 bg-cyan/5" : ""
      }`}
    >
      <div className="flex shrink-0 items-center justify-between px-1">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">
          {CALENDAR_ENTRY_STATUS_LABELS[status]}
        </h4>
        <span className="text-xs text-white/30">{entries.length}</span>
      </div>

      {/* Só a lista rola, dentro da coluna. */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
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
