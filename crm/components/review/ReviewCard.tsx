"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, MessageSquareWarning } from "lucide-react";
import { DEADLINE_CLASSES, DEADLINE_LABELS, deadlineInfo, formatDeadline } from "@/lib/deadline";
import { isImageUrl } from "@/lib/artwork";
import type { CalendarEntry, CalendarEntryReview } from "@/types/calendar";
import type { ClientRef } from "@/types/client";
import FileLightbox from "@/components/ui/FileLightbox";
import Linkify from "@/components/ui/Linkify";
import EntryReviewHistory from "@/components/production/EntryReviewHistory";

type Props = {
  entry: CalendarEntry;
  client?: ClientRef;
  assignee?: { id: number; full_name: string };
  members: { id: number; full_name: string }[];
  reviews: CalendarEntryReview[];
  highlighted?: boolean;
  busy?: boolean;
  onApprove: () => void;
  onRequestChanges: () => void;
};

/** O que o designer entregou, na ordem de publicação (feed, carrossel ou links do vídeo). */
function deliveredArt(entry: CalendarEntry): { images: string[]; story: string | null; links: string[] } {
  let images: string[] = [];
  if (entry.post_type === "carousel" && entry.final_images.length > 0) images = entry.final_images;
  else if (entry.final_image) images = [entry.final_image];
  return { images, story: entry.final_image_story, links: entry.final_links ?? [] };
}

const POST_TYPE_LABEL = { feed: "Feed", carousel: "Carrossel", video: "Vídeo" } as const;

function formatDate(iso: string) {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

export default function ReviewCard({ entry, client, assignee, members, reviews, highlighted, busy, onApprove, onRequestChanges }: Props) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);
  const deadline = deadlineInfo(entry);
  const { images, story, links } = deliveredArt(entry);
  const hasArt = images.length > 0 || !!story || links.length > 0;

  // Aviso que chegou por link (/revisao?demanda=7): leva o olho até o post.
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlighted]);

  return (
    <article
      ref={ref}
      className={`glass-card flex flex-col overflow-hidden rounded-2xl ${highlighted ? "ring-2 ring-cyan/60" : ""}`}
    >
      <header className="space-y-1 p-4 pb-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {client && <span className="font-semibold text-accent">{client.name}</span>}
          <span className="rounded-full bg-surface-2 px-2 py-0.5 font-semibold text-text-muted">
            Post {formatDate(entry.scheduled_date)}
          </span>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 font-semibold text-text-muted">
            {POST_TYPE_LABEL[entry.post_type]}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 font-semibold ${DEADLINE_CLASSES[deadline.state]}`}
            title={`Entregar até ${formatDeadline(deadline.deadline)}`}
          >
            {deadline.state === "atrasado" ? `Atrasado ${deadline.daysLate}d` : DEADLINE_LABELS[deadline.state]}
          </span>
          {assignee && <span className="ml-auto text-text-muted">Designer: {assignee.full_name}</span>}
        </div>
        <h2 className="text-base font-semibold text-text">{entry.title || entry.theme}</h2>
      </header>

      {hasArt ? (
        <div className="space-y-2 px-4">
          {images.length > 0 && (
            <div className={`grid gap-2 ${images.length > 1 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1"}`}>
              {images.map((url, index) =>
                isImageUrl(url) ? (
                  <button key={url + index} type="button" onClick={() => setLightbox(url)} className="overflow-hidden rounded-xl bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- URL do R2, sem loader configurado */}
                    <img
                      src={url}
                      alt={images.length > 1 ? `Slide ${index + 1}` : "Arte final"}
                      loading="lazy"
                      className={`w-full object-cover ${images.length > 1 ? "aspect-square" : "max-h-[28rem]"}`}
                    />
                  </button>
                ) : (
                  <a key={url + index} href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent underline">
                    Abrir arquivo {index + 1}
                  </a>
                ),
              )}
            </div>
          )}
          {story && isImageUrl(story) && (
            <button type="button" onClick={() => setLightbox(story)} className="flex items-center gap-3 rounded-xl bg-surface-2/60 p-2 text-left">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL do R2, sem loader configurado */}
              <img src={story} alt="Versão Stories" loading="lazy" className="h-24 w-14 rounded-lg object-cover" />
              <span className="text-xs text-text-muted">Versão Stories</span>
            </button>
          )}
          {links.map((link) => (
            <a
              key={link}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 break-all rounded-lg bg-surface-2/60 px-3 py-2 text-sm text-accent"
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              {link}
            </a>
          ))}
        </div>
      ) : (
        <p className="mx-4 rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-text-muted">
          O designer ainda não anexou a arte final.
        </p>
      )}

      <div className="space-y-3 p-4 text-sm">
        {entry.caption && (
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">Legenda</h3>
            <p className="whitespace-pre-wrap text-text">
              <Linkify text={entry.caption} />
            </p>
          </section>
        )}
        {entry.theme && (
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">Descrição</h3>
            <p className="whitespace-pre-wrap text-text-muted">
              <Linkify text={entry.theme} />
            </p>
          </section>
        )}
        {entry.change_request && (
          <section className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-500">
              <MessageSquareWarning className="h-3.5 w-3.5" />
              Pedido de alteração
            </h3>
            <p className="whitespace-pre-wrap text-text">
              <Linkify text={entry.change_request} />
            </p>
          </section>
        )}
        <EntryReviewHistory entryId={entry.id} status={entry.status} members={members} reviews={reviews} />
      </div>

      <footer className="mt-auto flex gap-2 border-t border-border p-3">
        <button
          type="button"
          disabled={busy}
          onClick={onApprove}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-500 transition hover:bg-emerald-500/25 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          Aprovar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onRequestChanges}
          className="flex-1 rounded-lg bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-500 transition hover:bg-amber-500/25 disabled:opacity-50"
        >
          Pedir ajustes
        </button>
      </footer>

      {lightbox && <FileLightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </article>
  );
}
