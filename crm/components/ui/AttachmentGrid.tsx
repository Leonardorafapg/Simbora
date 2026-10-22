"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileText, Loader2, Maximize2, Plus, Trash2 } from "lucide-react";
import { uploadArtwork } from "@/services/client/uploadsApi";
import { downloadFile, fileExtOf, fileNameOf, isImageUrl } from "@/lib/artwork";
import { removeAt } from "@/lib/postMedia";
import FileLightbox from "@/components/ui/FileLightbox";

const ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip";

type Props = {
  value: string[];
  onChange: (urls: string[]) => void;
  /** 1 = campo de arquivo único (um novo envio substitui o atual). Sem valor = vários. */
  max?: number;
  addLabel?: string;
  /** Mostra o número de cada item e setas pra mudar a ordem (ex.: slides de carrossel). */
  reorderable?: boolean;
};

/**
 * Anexos em miniaturas do MESMO tamanho (quadradas), imagens ou documentos (PDF, Word, Excel,
 * PowerPoint, ZIP). Passando o mouse: ver, baixar e remover. Ao abrir, o arquivo aparece no
 * tamanho real. Aceita arrastar e soltar.
 */
export default function AttachmentGrid({ value, onChange, max, addLabel = "Adicionar", reorderable = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  const single = max === 1;
  const full = !single && max !== undefined && value.length >= max;

  async function handleFiles(files: FileList | File[] | null | undefined) {
    setError(null);
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    const chosen = single ? list.slice(0, 1) : list;

    setUploading((n) => n + chosen.length);
    for (const file of chosen) {
      try {
        const url = await uploadArtwork(file);
        const next = single ? [url] : [...latest.current, url];
        latest.current = next;
        onChange(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível enviar o arquivo.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  function remove(index: number) {
    onChange(removeAt(latest.current, index));
  }

  function move(index: number, delta: number) {
    const next = [...latest.current];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    latest.current = next;
    onChange(next);
  }

  const iconBtn =
    "pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-[#fff] backdrop-blur transition hover:bg-black/85";

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`rounded-xl transition-colors ${dragOver ? "bg-accent-soft ring-2 ring-accent/50" : ""}`}
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
        {value.map((url, index) => {
          const image = isImageUrl(url);
          return (
            <div
              key={`${url}-${index}`}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-2"
            >
              <button
                type="button"
                onClick={() => setViewing(url)}
                className="block h-full w-full"
                title={fileNameOf(url)}
                aria-label={`Abrir ${fileNameOf(url)}`}
              >
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL do R2, sem loader configurado
                  <img src={url} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-2 text-text-muted">
                    <FileText className="h-8 w-8" />
                    <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent">
                      {fileExtOf(url)}
                    </span>
                    <span className="w-full truncate text-center text-[10px]">{fileNameOf(url)}</span>
                  </span>
                )}
              </button>

              {reorderable && value.length > 1 && (
                <span className="pointer-events-none absolute left-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-black/70 px-1 text-[11px] font-semibold text-[#fff]">
                  {index + 1}
                </span>
              )}
              {reorderable && value.length > 1 && (
                <div className="pointer-events-none absolute inset-x-0 top-1.5 flex justify-end gap-1 px-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  {index > 0 && (
                    <button type="button" onClick={() => move(index, -1)} title="Mover para antes" aria-label="Mover para antes" className={`${iconBtn} !h-6 !w-6`}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {index < value.length - 1 && (
                    <button type="button" onClick={() => move(index, 1)} title="Mover para depois" aria-label="Mover para depois" className={`${iconBtn} !h-6 !w-6`}>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                <button type="button" onClick={() => setViewing(url)} title="Ver" aria-label="Ver" className={iconBtn}>
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => downloadFile(url)} title="Baixar" aria-label="Baixar" className={iconBtn}>
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => remove(index)} title="Remover" aria-label="Remover" className={`${iconBtn} hover:!bg-danger`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {Array.from({ length: uploading }, (_, i) => (
          <div key={`up-${i}`} className="skeleton flex aspect-square items-center justify-center rounded-lg">
            <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
          </div>
        ))}

        {!full && !(single && value.length > 0) && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-hover text-text-faint transition-colors hover:border-accent hover:text-accent"
          >
            <Plus className="h-5 w-5" />
            <span className="px-1 text-center text-[11px] leading-tight">{addLabel}</span>
          </button>
        )}
      </div>

      <p className="mt-1.5 text-[11px] text-text-faint">
        Imagens, PDF, Word, Excel, PowerPoint ou ZIP. Arraste para cá ou clique em +.
      </p>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple={!single}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {viewing && <FileLightbox url={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
