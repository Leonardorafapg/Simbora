"use client";

import { useState } from "react";
import { BarChart3, ExternalLink, Film, Pencil, RotateCw, Send, Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import InstagramPostForm, { type InstagramPostFormValues } from "./InstagramPostForm";
import { fetchPostInsights } from "@/services/client/instagramApi";
import { METRIC_LABELS, POST_STATUS_CLASSES, POST_STATUS_LABELS, formatBrt, formatMetric, isVideoUrl } from "@/lib/instagram";
import { INSTAGRAM_MEDIA_TYPE_LABELS, type InsightsMetrics, type InstagramPost, type InstagramPostUpdate } from "@/types/instagram";

type Props = {
  post: InstagramPost;
  canManage: boolean;
  onUpdate: (id: number, input: InstagramPostUpdate) => Promise<unknown>;
  onPublishNow: (id: number) => Promise<unknown>;
  onRemove: (id: number) => Promise<unknown>;
};

export function InstagramStatusBadge({ post }: { post: InstagramPost }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${POST_STATUS_CLASSES[post.status]}`}>
      {POST_STATUS_LABELS[post.status]}
    </span>
  );
}

export default function InstagramPostItem({ post, canManage, onUpdate, onPublishNow, onRemove }: Props) {
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<InsightsMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const editable = post.status === "pendente" || post.status === "erro";
  const thumb = post.media_urls[0];

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }

  async function handleEdit(values: InstagramPostFormValues) {
    const input: InstagramPostUpdate = {
      media_type: values.media_type,
      media_urls: values.media_urls,
      caption: values.caption,
    };
    if (values.scheduled_at) input.scheduled_at = values.scheduled_at;
    await onUpdate(post.id, input);
    setEditing(false);
  }

  async function loadMetrics() {
    if (metrics) return setMetrics(null);
    setMetricsLoading(true);
    setError(null);
    try {
      setMetrics((await fetchPostInsights(post.id)).metrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar métricas.");
    } finally {
      setMetricsLoading(false);
    }
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-cyan/30 bg-surface-2 p-4">
        <InstagramPostForm post={post} submitLabel="Salvar" onSubmit={handleEdit} onCancel={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      <div className="flex gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-black/30">
          {thumb &&
            (isVideoUrl(thumb) ? (
              <video src={thumb} className="h-full w-full object-cover" muted playsInline preload="metadata" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- URL externa (R2), sem loader configurado
              <img src={thumb} alt="" className="h-full w-full object-cover" />
            ))}
          {thumb && isVideoUrl(thumb) && <Film className="absolute left-1 top-1 h-3.5 w-3.5 text-text drop-shadow" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <InstagramStatusBadge post={post} />
            <span className="text-xs text-text-muted">
              {INSTAGRAM_MEDIA_TYPE_LABELS[post.media_type]}
              {post.media_urls.length > 1 ? ` · ${post.media_urls.length} mídias` : ""}
            </span>
          </div>
          <p className="mt-1 text-xs text-text">
            {post.status === "publicado" ? `Publicado em ${formatBrt(post.published_at)}` : `Agendado para ${formatBrt(post.scheduled_at)}`}
          </p>
          {post.caption && <p className="mt-1 line-clamp-2 text-xs text-text-muted">{post.caption}</p>}
          {post.error_message && (
            <p className={`mt-1 text-xs ${post.status === "erro" ? "text-danger" : "text-amber-300"}`}>{post.error_message}</p>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {post.permalink && (
          <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-cyan hover:bg-surface-2">
            <ExternalLink className="h-3.5 w-3.5" /> Ver no Instagram
          </a>
        )}
        {post.status === "publicado" && post.ig_media_id && (
          <button type="button" onClick={loadMetrics} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-text hover:bg-surface-2">
            <BarChart3 className="h-3.5 w-3.5" /> {metricsLoading ? "Carregando..." : metrics ? "Ocultar métricas" : "Métricas"}
          </button>
        )}
        {canManage && editable && (
          <>
            <button type="button" disabled={busy} onClick={() => setEditing(true)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-text hover:bg-surface-2">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirmPublish(true)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-text hover:bg-surface-2">
              {post.status === "erro" ? <RotateCw className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
              {post.status === "erro" ? "Tentar de novo" : "Publicar agora"}
            </button>
          </>
        )}
        {canManage && post.status !== "publicando" && (
          <button type="button" disabled={busy} onClick={() => setConfirmRemove(true)} className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-danger hover:bg-surface-2">
            <Trash2 className="h-3.5 w-3.5" /> Remover
          </button>
        )}
      </div>

      {metrics && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(metrics).map(([key, value]) => (
            <div key={key} className="rounded-lg bg-black/20 px-2 py-1.5">
              <p className="text-[10px] text-text-faint">{METRIC_LABELS[key] ?? key}</p>
              <p className="text-sm font-semibold text-text">{formatMetric(key, value)}</p>
            </div>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      <ConfirmDialog
        open={confirmPublish}
        title={post.status === "erro" ? "Tentar publicar de novo?" : "Publicar agora?"}
        description={
          post.status === "erro"
            ? "Antes, confira no Instagram se o post não saiu — o CRM verifica, mas não custa olhar."
            : "O post vai pro Instagram agora, sem esperar o horário agendado."
        }
        confirmLabel="Publicar"
        loading={busy}
        onConfirm={() => run(() => onPublishNow(post.id)).then(() => setConfirmPublish(false))}
        onCancel={() => setConfirmPublish(false)}
      />
      <ConfirmDialog
        open={confirmRemove}
        title="Remover agendamento?"
        description={
          post.status === "publicado"
            ? "Remove só do CRM — o post continua no Instagram."
            : "O post não será publicado."
        }
        confirmLabel="Remover"
        loading={busy}
        onConfirm={() => run(() => onRemove(post.id)).then(() => setConfirmRemove(false))}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  );
}
