"use client";

import { useState } from "react";
import InstagramMediaPicker from "./InstagramMediaPicker";
import { CAPTION_MAX, brtInputFromNow, brtInputToIso, countHashtags, isVideoUrl, isoToBrtInput } from "@/lib/instagram";
import { INSTAGRAM_MEDIA_TYPE_LABELS, type InstagramMediaType, type InstagramPost } from "@/types/instagram";

export type InstagramPostFormValues = {
  media_type: InstagramMediaType;
  media_urls: string[];
  caption: string | null;
  /** null = publicar agora, ou (na edição) horário não mudou. */
  scheduled_at: string | null;
  publish_now: boolean;
};

type Props = {
  /** Editando um agendamento existente. */
  post?: InstagramPost | null;
  /** Valores iniciais de um post novo (ex.: arte e legenda da postagem aprovada). */
  initial?: { mediaType?: InstagramMediaType; mediaUrls?: string[]; caption?: string | null; date?: string | null };
  submitLabel: string;
  onSubmit: (values: InstagramPostFormValues) => Promise<unknown>;
  onCancel?: () => void;
};

/** Mesmas regras do backend, pra avisar antes de enviar (o backend confere de novo). */
function clientSideError(mediaType: InstagramMediaType, urls: string[], caption: string): string | null {
  const videos = urls.filter(isVideoUrl).length;
  if (!urls.length) return "Adicione a mídia do post.";
  if (mediaType === "IMAGE" && (urls.length !== 1 || videos)) return "Feed precisa de exatamente 1 imagem (vídeo vai como Reels).";
  if (mediaType === "REELS" && (urls.length !== 1 || !videos)) return "Reels precisa de exatamente 1 vídeo.";
  if (mediaType === "STORIES" && urls.length !== 1) return "Story precisa de exatamente 1 imagem ou vídeo.";
  if (mediaType === "CAROUSEL" && (urls.length < 2 || urls.length > 10)) return "Carrossel precisa de 2 a 10 mídias.";
  if (mediaType !== "STORIES") {
    if (caption.length > CAPTION_MAX) return `A legenda passou de ${CAPTION_MAX} caracteres.`;
    if (countHashtags(caption) > 30) return "O Instagram aceita no máximo 30 hashtags.";
  }
  return null;
}

function initialDateTime(post: InstagramPost | null | undefined, date: string | null | undefined): string {
  if (post) return isoToBrtInput(post.scheduled_at);
  const fallback = brtInputFromNow(60);
  if (!date) return fallback;
  const candidate = `${date}T12:00`;
  return candidate > fallback ? candidate : fallback; // data da postagem já passou: sugere daqui a 1h
}

export default function InstagramPostForm({ post, initial, submitLabel, onSubmit, onCancel }: Props) {
  const [mediaType, setMediaType] = useState<InstagramMediaType>(post?.media_type ?? initial?.mediaType ?? "IMAGE");
  const [mediaUrls, setMediaUrls] = useState<string[]>(post?.media_urls ?? initial?.mediaUrls ?? []);
  const [caption, setCaption] = useState(post?.caption ?? initial?.caption ?? "");
  const [when, setWhen] = useState(() => initialDateTime(post, initial?.date));
  const [publishNow, setPublishNow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStory = mediaType === "STORIES";
  const hashtags = countHashtags(caption);

  async function handleSubmit() {
    setError(null);
    const problem = clientSideError(mediaType, mediaUrls, caption);
    if (problem) return setError(problem);
    if (!publishNow && !when) return setError("Escolha a data e o horário.");
    setSaving(true);
    try {
      await onSubmit({
        media_type: mediaType,
        media_urls: mediaUrls,
        caption: isStory ? null : caption.trim() || null,
        // Editando sem mexer no horário: não reenvia (um post com erro e horário
        // vencido seria recusado como "horário já passou").
        scheduled_at: publishNow || (post && when === isoToBrtInput(post.scheduled_at)) ? null : brtInputToIso(when),
        publish_now: publishNow,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(INSTAGRAM_MEDIA_TYPE_LABELS) as InstagramMediaType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setMediaType(type)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              mediaType === type ? "bg-cyan text-black" : "bg-surface-2 text-text-muted hover:text-text"
            }`}
          >
            {INSTAGRAM_MEDIA_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      <InstagramMediaPicker mediaType={mediaType} value={mediaUrls} onChange={setMediaUrls} disabled={saving} />

      {isStory ? (
        <p className="text-xs text-text-faint">Story não tem legenda no Instagram.</p>
      ) : (
        <div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Legenda"
            className="glass-input min-h-[120px] w-full rounded-lg px-3 py-2 text-sm outline-none"
          />
          <p className={`text-right text-[11px] ${caption.length > CAPTION_MAX || hashtags > 30 ? "text-danger" : "text-text-faint"}`}>
            {caption.length}/{CAPTION_MAX} · {hashtags}/30 hashtags
          </p>
        </div>
      )}

      {!post && (
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />
          Publicar agora
        </label>
      )}
      {!publishNow && (
        <div>
          <p className="mb-1 text-xs text-text-muted">Data e horário (Brasília)</p>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="glass-input w-full rounded-lg px-3 py-2 text-sm outline-none"
          />
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-sm text-text-muted hover:text-text">
            Cancelar
          </button>
        )}
        <button
          type="button"
          disabled={saving}
          onClick={handleSubmit}
          className="rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-dark disabled:opacity-60"
        >
          {saving ? "Salvando..." : publishNow ? "Publicar agora" : submitLabel}
        </button>
      </div>
    </div>
  );
}
