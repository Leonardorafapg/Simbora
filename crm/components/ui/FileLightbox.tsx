"use client";

import { useEffect } from "react";
import { Download, ExternalLink, FileText, X } from "lucide-react";
import { downloadFile, fileNameOf, isImageUrl, isPdfUrl } from "@/lib/artwork";

/** Visualizador em tela cheia: imagem no tamanho real, PDF embutido e atalho para baixar. Esc ou clique fora fecham. */
export default function FileLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    // Em fase de captura e parando a propagação: o Esc fecha só o visualizador, não o drawer atrás.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const image = isImageUrl(url);
  const pdf = isPdfUrl(url);
  const name = fileNameOf(url);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/85 backdrop-blur-sm"
      role="dialog"
      aria-label="Visualizar arquivo"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex shrink-0 items-center gap-3 px-5 py-3 text-[#fff]">
        <p className="min-w-0 flex-1 truncate text-sm text-[#ffffffcc]" title={name}>
          {name}
        </p>
        <button
          type="button"
          onClick={() => downloadFile(url)}
          className="flex items-center gap-2 rounded-lg bg-[#ffffff1a] px-3 py-1.5 text-xs font-semibold transition hover:bg-[#ffffff33]"
        >
          <Download className="h-4 w-4" />
          Baixar
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg bg-[#ffffff1a] px-3 py-1.5 text-xs font-semibold transition hover:bg-[#ffffff33]"
        >
          <ExternalLink className="h-4 w-4" />
          Abrir
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="rounded-full p-1.5 transition hover:bg-[#ffffff1a]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        className="flex min-h-0 flex-1 items-center justify-center p-4"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL do R2, sem loader configurado
          <img src={url} alt={name} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
        ) : pdf ? (
          <iframe src={url} title={name} className="h-full w-full max-w-5xl rounded-lg bg-white" />
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-[#ffffff1a] px-10 py-12 text-[#fff]">
            <FileText className="h-14 w-14 text-[#ffffffb3]" />
            <p className="max-w-xs truncate text-sm">{name}</p>
            <p className="text-xs text-[#ffffff99]">Este tipo de arquivo não tem pré-visualização. Use Baixar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
