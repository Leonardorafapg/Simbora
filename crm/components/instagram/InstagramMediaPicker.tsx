"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Film, X } from "lucide-react";
import { uploadMedia } from "@/services/client/uploadsApi";
import { isVideoUrl } from "@/lib/instagram";
import type { InstagramMediaType } from "@/types/instagram";

type Props = {
  mediaType: InstagramMediaType;
  value: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
};

const ACCEPT: Record<InstagramMediaType, string> = {
  IMAGE: "image/jpeg,image/png,image/webp",
  CAROUSEL: "image/jpeg,image/png,image/webp,video/mp4,video/quicktime",
  REELS: "video/mp4,video/quicktime",
  STORIES: "image/jpeg,image/png,image/webp,video/mp4,video/quicktime",
};

const MAX_ITEMS: Record<InstagramMediaType, number> = { IMAGE: 1, CAROUSEL: 10, REELS: 1, STORIES: 1 };

const HINT: Record<InstagramMediaType, string> = {
  IMAGE: "1 imagem, proporção entre 4:5 (1080x1350) e 1,91:1",
  CAROUSEL: "2 a 10 imagens/vídeos, na ordem em que vão aparecer",
  REELS: "1 vídeo MP4/MOV (vertical 9:16 recomendado), até 300 MB",
  STORIES: "1 imagem ou vídeo (vertical 9:16 recomendado)",
};

/** Mídias do post do Instagram: envia pro R2 e mantém a ordem (importa no carrossel). */
export default function InstagramMediaPicker({ mediaType, value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const max = MAX_ITEMS[mediaType];
  const full = value.length >= max;

  async function handleFiles(fileList: FileList | null) {
    setError(null);
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    const allowed = ACCEPT[mediaType].split(",");
    if (files.some((f) => !allowed.includes(f.type))) {
      setError(mediaType === "REELS" ? "Reels aceita só vídeo MP4 ou MOV." : "Use imagem JPG/PNG/WebP ou vídeo MP4/MOV.");
      return;
    }
    if (value.length + files.length > max) {
      setError(`Máximo de ${max} ${max === 1 ? "arquivo" : "arquivos"} para esse formato.`);
      return;
    }
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of files) uploaded.push(await uploadMedia(file)); // sequencial: preserva a ordem
      onChange([...value, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o arquivo.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function move(index: number, delta: number) {
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {value.map((url, index) => (
            <div key={`${url}-${index}`} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-black/30">
              {isVideoUrl(url) ? (
                <video src={url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- URL externa (R2), sem loader configurado
                <img src={url} alt={`Mídia ${index + 1}`} className="h-full w-full object-cover" />
              )}
              {isVideoUrl(url) && <Film className="absolute left-1 top-1 h-3.5 w-3.5 text-text drop-shadow" />}
              {value.length > 1 && (
                <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] text-text">{index + 1}</span>
              )}
              {!disabled && (
                <div className="absolute inset-x-0 top-0 flex justify-end gap-0.5 p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  {index > 0 && (
                    <button type="button" onClick={() => move(index, -1)} className="rounded bg-black/70 p-0.5 text-text" aria-label="Mover para antes">
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {index < value.length - 1 && (
                    <button type="button" onClick={() => move(index, 1)} className="rounded bg-black/70 p-0.5 text-text" aria-label="Mover para depois">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((_, i) => i !== index))}
                    className="rounded bg-black/70 p-0.5 text-text hover:text-danger"
                    aria-label="Remover"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!disabled && !full && (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-lg border border-dashed border-border px-3 py-3 text-center text-xs text-text-muted transition hover:border-border-hover disabled:cursor-wait disabled:text-text-faint"
        >
          {uploading ? "Enviando..." : "Clique para adicionar mídia"}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[mediaType]}
        multiple={max > 1}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="text-[11px] text-text-faint">{HINT[mediaType]}</p>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
