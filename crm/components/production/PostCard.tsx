import { useDraggable } from "@dnd-kit/core";
import { AlignLeft, Paperclip } from "lucide-react";
import type { CalendarEntry } from "@/types/calendar";
import type { Client } from "@/types/client";
import { formatDate } from "@/lib/format";
import { DEADLINE_CLASSES, DEADLINE_LABELS, deadlineInfo, formatDeadline } from "@/lib/deadline";
import { tagChipClass } from "@/lib/tagColors";

/** Capa do card: a arte final, senão a referência, senão o primeiro material. */
function coverOf(entry: CalendarEntry): string | null {
  return entry.final_image || entry.reference_image || entry.material_files[0] || null;
}

/** Quantidade de arquivos anexados à postagem (referência + material + arte final). */
function attachmentCount(entry: CalendarEntry): number {
  return (entry.reference_image ? 1 : 0) + (entry.final_image ? 1 : 0) + entry.material_files.length;
}

type ContentProps = {
  entry: CalendarEntry;
  client?: Client;
  onSelect?: (entry: CalendarEntry) => void;
};

/** Conteúdo do card no estilo Trello: capa em largura total, etiquetas, título e rodapé com ícones. */
function PostCardContent({ entry, client, onSelect }: ContentProps) {
  const deadline = deadlineInfo(entry);
  const cover = coverOf(entry);
  const attachments = attachmentCount(entry);

  return (
    <button type="button" onClick={() => onSelect?.(entry)} className="block w-full text-left">
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element -- URL do R2, sem loader configurado
        <img
          src={cover}
          alt=""
          loading="lazy"
          draggable={false}
          className="max-h-64 w-full object-cover"
        />
      )}

      <div className="space-y-2 p-3">
        {entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {entry.tags.map((tag) => (
              <span
                key={tag.id}
                title={tag.name}
                className={`max-w-full truncate rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${tagChipClass(tag.color)}`}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        <p className="line-clamp-3 text-sm text-text">{entry.title || entry.theme}</p>
        {client && <p className="truncate text-xs text-accent">{client.name}</p>}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-text-muted">
          {entry.theme && (
            <span title="Tem descrição" className="flex items-center">
              <AlignLeft className="h-3.5 w-3.5" />
            </span>
          )}
          {attachments > 0 && (
            <span title={`${attachments} anexo${attachments === 1 ? "" : "s"}`} className="flex items-center gap-1 text-[11px]">
              <Paperclip className="h-3.5 w-3.5" />
              {attachments}
            </span>
          )}
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-text-muted">
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
      className={`overflow-hidden rounded-xl border border-border bg-surface-2 shadow-[var(--elev-card)] ${isDragging ? "opacity-40" : ""}`}
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
    <div className="cursor-grabbing overflow-hidden rounded-xl border border-accent-border bg-surface-2 shadow-2xl">
      <PostCardContent entry={entry} client={client} />
    </div>
  );
}
