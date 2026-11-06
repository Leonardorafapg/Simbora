"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Hourglass,
  MessageCircle,
  MessageSquareWarning,
  Maximize2,
  Paperclip,
  StickyNote,
  Undo2,
} from "lucide-react";
import { DEADLINE_CLASSES, DEADLINE_LABELS, deadlineInfo, formatDeadline } from "@/lib/deadline";
import { isImageUrl } from "@/lib/artwork";
import { briefingAttachmentCount, deliveredArt } from "@/lib/reviewQueue";
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
  /** Modo lista: arte pequena ao lado da legenda, em vez da arte grande. */
  compact?: boolean;
  onApprove: () => void;
  onRequestChanges: () => void;
  /** Abre o briefing completo (a mesma tela de detalhes dos designers). */
  onOpenDetails: () => void;
  /** Mouse (ou foco) entrou/saiu do card: a tecla Espaço abre o card sobre o qual estiver. */
  onHoverChange?: (hovering: boolean) => void;
};

const POST_TYPE_LABEL = { feed: "Feed", carousel: "Carrossel", video: "Vídeo" } as const;

function formatDate(iso: string) {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

/** Plano B quando o navegador nega `navigator.clipboard` (permissão, página sem foco): seleciona e copia. */
function legacyCopy(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(area);
  return ok;
}

/** Botão "Copiar" da legenda: confirma por um instante e avisa se não conseguiu copiar. */
function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = legacyCopy(text);
    }
    setState(ok ? "copied" : "failed");
    window.setTimeout(() => setState("idle"), 1800);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-surface ${
        state === "failed" ? "text-danger" : "text-text-muted hover:text-text"
      }`}
    >
      {state === "copied" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {state === "copied" ? "Copiado" : state === "failed" ? "Não copiou" : "Copiar"}
    </button>
  );
}

export default function ReviewCard({
  entry,
  client,
  assignee,
  members,
  reviews,
  highlighted,
  busy,
  compact,
  onApprove,
  onRequestChanges,
  onOpenDetails,
  onHoverChange,
}: Props) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const deadline = deadlineInfo(entry);
  const { images, story, links } = deliveredArt(entry);
  const hasArt = images.length > 0 || !!story || links.length > 0;
  const attachments = briefingAttachmentCount(entry);
  const changeRequest = entry.change_request?.trim() || null;
  const notesCount = (changeRequest ? 1 : 0) + reviews.length;
  const designerName = assignee?.full_name.split(" ")[0];
  const artLabel =
    entry.post_type === "carousel" ? `Carrossel · ${images.length || 0}` : entry.post_type === "video" ? "Vídeo" : "Feed";

  // Aviso que chegou por link (/revisao?demanda=7): leva o olho até o post.
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlighted]);

  const statusChip = changeRequest
    ? { label: "Ajuste pendente", className: "bg-amber-500/15 text-amber-500", title: "Há um pedido de alteração neste post" }
    : {
        label: deadline.state === "atrasado" ? `Atrasado ${deadline.daysLate}d` : DEADLINE_LABELS[deadline.state],
        className: DEADLINE_CLASSES[deadline.state],
        title: `Entregar até ${formatDeadline(deadline.deadline)}`,
      };

  return (
    <article
      ref={ref}
      data-review-id={entry.id}
      onPointerEnter={() => onHoverChange?.(true)}
      onPointerLeave={() => onHoverChange?.(false)}
      onFocus={() => onHoverChange?.(true)}
      onBlur={() => onHoverChange?.(false)}
      className={`glass-card flex flex-col overflow-hidden rounded-2xl ${highlighted ? "ring-2 ring-accent/60" : ""}`}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 text-[11px]">
        {client && (
          <span className="max-w-full truncate rounded-md bg-accent-soft px-2 py-1 font-bold uppercase tracking-wide text-accent">
            {client.name}
          </span>
        )}
        <span className="rounded-md bg-surface-2 px-2 py-1 font-semibold text-text-muted">
          Post {formatDate(entry.scheduled_date)}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <span
            title={statusChip.title}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${statusChip.className}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {statusChip.label}
          </span>
          {designerName && <span className="text-text-faint">por {designerName}</span>}
        </span>
      </header>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-bold uppercase leading-snug text-text">{entry.title || entry.theme}</h2>
          <span className="shrink-0 rounded-md bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-muted">
            {POST_TYPE_LABEL[entry.post_type]}
          </span>
        </div>

        <div className={compact ? "flex flex-col gap-3 sm:flex-row" : "space-y-3"}>
          {hasArt ? (
            <div className={compact ? "sm:w-44 sm:shrink-0" : ""}>
              {images.length > 0 && (
                <div className="relative">
                  <div className={`grid gap-2 ${images.length > 1 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1"}`}>
                    {images.map((url, index) =>
                      isImageUrl(url) ? (
                        <button
                          key={url + index}
                          type="button"
                          onClick={() => setLightbox(url)}
                          className="flex w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-2"
                        >
                          {/* object-contain: a revisão precisa ver a arte inteira, sem corte; a altura é limitada pra não ocupar a tela toda. */}
                          {/* eslint-disable-next-line @next/next/no-img-element -- URL do R2, sem loader configurado */}
                          <img
                            src={url}
                            alt={images.length > 1 ? `Slide ${index + 1}` : "Arte final"}
                            loading="lazy"
                            className={
                              images.length > 1 || compact
                                ? "aspect-square w-full object-contain"
                                : "max-h-[26rem] w-auto max-w-full object-contain"
                            }
                          />
                        </button>
                      ) : (
                        <a
                          key={url + index}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-accent underline"
                        >
                          Abrir arquivo {index + 1}
                        </a>
                      ),
                    )}
                  </div>
                  {/* Fora da imagem, de propósito: botão por cima taparia parte da arte que está sendo revisada. */}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="rounded-md bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-muted">
                      {artLabel}
                    </span>
                    {!compact && isImageUrl(images[0]) && (
                      <button
                        type="button"
                        onClick={() => setLightbox(images[0])}
                        className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/60 px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:text-text"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                        Expandir inspeção
                      </button>
                    )}
                  </div>
                </div>
              )}
              {story && isImageUrl(story) && (
                <button
                  type="button"
                  onClick={() => setLightbox(story)}
                  className="mt-2 flex items-center gap-3 rounded-xl bg-surface-2/60 p-2 text-left"
                >
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
                  className="mt-2 flex items-center gap-2 break-all rounded-lg bg-surface-2/60 px-3 py-2 text-sm text-accent"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" />
                  {link}
                </a>
              ))}
            </div>
          ) : (
            <div
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 text-center ${
                compact ? "py-6 sm:w-44 sm:shrink-0" : "py-10"
              }`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Hourglass className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold text-text">Aguardando arte final do designer</p>
              <p className="text-xs text-text-faint">Briefing e roteiro disponíveis</p>
            </div>
          )}

          <section className="min-w-0 flex-1 rounded-xl border border-border bg-surface-2/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                <MessageCircle className="h-3.5 w-3.5" />
                Legenda
              </h3>
              {entry.caption && <CopyButton text={entry.caption} />}
            </div>
            {entry.caption ? (
              <p className={`whitespace-pre-wrap break-words text-sm text-text ${compact ? "line-clamp-4" : ""}`}>
                <Linkify text={entry.caption} />
              </p>
            ) : (
              <p className="text-sm italic text-text-faint">Sem legenda.</p>
            )}
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onOpenDetails}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/60 px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:text-text"
          >
            <Paperclip className="h-3.5 w-3.5 text-emerald-500" />
            Arquivos Anexos
            <span className="rounded-full bg-surface px-1.5 py-0.5 text-[11px]">{attachments}</span>
          </button>
          <button
            type="button"
            onClick={onOpenDetails}
            className="flex items-center gap-1.5 text-xs font-semibold text-text-muted transition-colors hover:text-accent"
          >
            Ver briefing completo
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {notesOpen && (
          <div className="space-y-3">
            {changeRequest && (
              <section className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-500">
                  <MessageSquareWarning className="h-3.5 w-3.5" />
                  Pedido de alteração
                </h3>
                <p className="whitespace-pre-wrap text-sm text-text">
                  <Linkify text={changeRequest} />
                </p>
              </section>
            )}
            <EntryReviewHistory entryId={entry.id} status={entry.status} members={members} reviews={reviews} />
            {notesCount === 0 && (
              <p className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-xs text-text-faint">
                Nenhuma nota ou ajuste neste post ainda.
              </p>
            )}
          </div>
        )}
      </div>

      <footer className="mt-auto flex items-center gap-2 border-t border-border px-3 py-3">
        <button
          type="button"
          onClick={() => setNotesOpen((open) => !open)}
          aria-expanded={notesOpen}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
            notesOpen ? "border-accent-border bg-accent-soft text-accent" : "border-border bg-surface-2/60 text-text-muted hover:text-text"
          }`}
        >
          <StickyNote className="h-3.5 w-3.5" />
          Ajustes / Notas
          {notesCount > 0 && <span className="rounded-full bg-surface px-1.5 py-0.5 text-[11px]">{notesCount}</span>}
        </button>
        <span className="flex-1" />
        <button
          type="button"
          disabled={busy}
          onClick={onRequestChanges}
          className="flex items-center gap-1.5 rounded-lg border border-danger/50 px-3 py-2 text-sm font-semibold text-danger transition hover:bg-danger/10 disabled:opacity-50"
        >
          <Undo2 className="h-4 w-4" />
          Ajuste
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onApprove}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          Aprovar
        </button>
      </footer>

      {lightbox && <FileLightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </article>
  );
}
