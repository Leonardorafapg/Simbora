import { useDraggable } from "@dnd-kit/core";
import { AlignLeft, Paperclip } from "lucide-react";
import type { CalendarEntry } from "@/types/calendar";
import type { Client } from "@/types/client";
import { formatDate } from "@/lib/format";
import { DEADLINE_CLASSES, DEADLINE_LABELS, deadlineInfo, formatDeadline } from "@/lib/deadline";
import { tagChipClass } from "@/lib/tagColors";
import { POST_STATUS_CLASSES, formatBrt } from "@/lib/instagram";
import type { InstagramPost } from "@/types/instagram";
import { isImageUrl } from "@/lib/artwork";
import type { TeamMember } from "@/types/team";

/** Quem aparece no card: serve tanto o membro completo quanto a entrada do diretório (sem foto). */
export type CardPerson = Pick<TeamMember, "id" | "full_name"> & { photo_url?: string | null };
import { getInitials } from "@/lib/format";

const IG_BADGE: Record<InstagramPost["status"], string> = {
  pendente: "IG agendado",
  publicando: "IG publicando",
  publicado: "IG publicado",
  erro: "IG com erro",
};

/** Capa do card: a arte final, senão a referência, senão o primeiro material. */
function coverOf(entry: CalendarEntry): string | null {
  return [entry.final_image, entry.reference_image, ...entry.material_files].find((url) => isImageUrl(url)) ?? null;
}

/** Quantidade de arquivos anexados à postagem (referência + material + arte final). */
function attachmentCount(entry: CalendarEntry): number {
  return (entry.reference_image ? 1 : 0) + (entry.final_image ? 1 : 0) + entry.material_files.length;
}

type ContentProps = {
  entry: CalendarEntry;
  client?: Client;
  requester?: CardPerson;
  assignee?: CardPerson;
  onSelect?: (entry: CalendarEntry) => void;
  instagramPost?: InstagramPost;
};

/** Conteúdo do card no estilo Trello: capa em largura total, etiquetas, título e rodapé com ícones. */
function PostCardContent({ entry, client, requester, assignee, onSelect, instagramPost }: ContentProps) {
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
          className="post-cover max-h-64 w-full object-cover"
        />
      )}

      <div className="space-y-[var(--gap-card)] p-[var(--pad-card)]">
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
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${DEADLINE_CLASSES[deadline.state]}`}
            title={`Entregar até ${formatDeadline(deadline.deadline)}`}
          >
            {deadline.state === "atrasado" && <span className="pulse-dot" aria-hidden="true" />}
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
        {instagramPost && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${POST_STATUS_CLASSES[instagramPost.status]}`}
            title={instagramPost.error_message ?? undefined}
          >
            {IG_BADGE[instagramPost.status]}
            {instagramPost.status === "pendente" ? ` ${formatBrt(instagramPost.scheduled_at)}` : ""}
          </span>
        )}
        </div>
          {(requester || assignee) && (
            <span className="ml-auto flex -space-x-1.5">
              {[requester, assignee]
                .filter((p, i, arr): p is CardPerson => !!p && arr.findIndex((q) => q?.id === p.id) === i)
                .map((person) => (
                  <span
                    key={person.id}
                    title={`${person.id === assignee?.id ? "Responsável" : "Solicitante"}: ${person.full_name}`}
                    className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-accent-soft text-[9px] font-bold text-accent ring-2 ring-surface-2"
                  >
                    {person.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL externa sem loader
                      <img src={person.photo_url} alt={person.full_name} className="h-full w-full object-cover" />
                    ) : (
                      getInitials(person.full_name)
                    )}
                  </span>
                ))}
            </span>
          )}
      </div>
    </button>
  );
}

type Props = {
  entry: CalendarEntry;
  client?: Client;
  requester?: CardPerson;
  assignee?: CardPerson;
  canEdit: boolean;
  onSelect: (entry: CalendarEntry) => void;
  instagramPost?: InstagramPost;
};

export default function PostCard({ entry, client, requester, assignee, canEdit, onSelect, instagramPost }: Props) {
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
      className={`animate-fade-up stagger overflow-hidden rounded-xl border border-border bg-surface-2 shadow-[var(--elev-card)] transition-[border-color,box-shadow] duration-200 hover:border-accent-border hover:shadow-[0_0_20px_color-mix(in_srgb,var(--accent)_18%,transparent)] ${isDragging ? "opacity-40" : ""}`}
    >
      <div
        {...(canEdit ? { ...attributes, ...listeners } : {})}
        className={canEdit ? "cursor-grab active:cursor-grabbing" : ""}
      >
        <PostCardContent
          entry={entry}
          client={client}
          requester={requester}
          assignee={assignee}
          onSelect={onSelect}
          instagramPost={instagramPost}
        />
      </div>
    </div>
  );
}

/** Cartão que acompanha o ponteiro durante o arraste (renderizado no DragOverlay). */
export function PostCardOverlay({ entry, client }: { entry: CalendarEntry; client?: Client }) {
  return (
    <div className="rotate-2 cursor-grabbing overflow-hidden rounded-xl border border-accent bg-surface-2 shadow-[0_0_32px_color-mix(in_srgb,var(--accent)_35%,transparent)]">
      <PostCardContent entry={entry} client={client} />
    </div>
  );
}
