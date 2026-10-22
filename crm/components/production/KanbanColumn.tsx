import { useDroppable } from "@dnd-kit/core";
import type { CalendarEntry, CalendarEntryStatus } from "@/types/calendar";
import { CALENDAR_ENTRY_STATUS_LABELS } from "@/types/calendar";
import type { Client } from "@/types/client";
import type { InstagramPost } from "@/types/instagram";
import PostCard, { type CardPerson } from "./PostCard";

type Props = {
  status: CalendarEntryStatus;
  entries: CalendarEntry[];
  clients: Client[];
  members: CardPerson[];
  canEdit: boolean;
  onSelect: (entry: CalendarEntry) => void;
  /** Agendamento do Instagram por id de postagem. */
  instagramByEntry?: Record<string, InstagramPost>;
};

export default function KanbanColumn({ status, entries, clients, members, canEdit, onSelect, instagramByEntry }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`glass-card flex h-full min-h-0 flex-col gap-2 rounded-2xl p-3 transition-colors ${
        isOver ? "ring-2 ring-cyan/50 bg-cyan/5" : ""
      }`}
    >
      <div className="flex shrink-0 items-center justify-between px-1">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {CALENDAR_ENTRY_STATUS_LABELS[status]}
        </h4>
        <span className="text-xs text-text-faint">{entries.length}</span>
      </div>

      {/* Só a lista rola, dentro da coluna. */}
      <div className="min-h-0 flex-1 space-y-[var(--gap-card)] overflow-y-auto pr-1">
        {entries.map((entry, index) => (
          <div key={entry.id} className="stagger" style={{ "--i": index } as React.CSSProperties}>
          <PostCard
            entry={entry}
            client={clients.find((c) => c.id === entry.client_id)}
            requester={members.find((m) => m.id === entry.requester_id)}
            assignee={members.find((m) => m.id === entry.assignee_id)}
            canEdit={canEdit}
            onSelect={onSelect}
            instagramPost={instagramByEntry?.[entry.id]}
          />
          </div>
        ))}
      </div>
    </div>
  );
}
