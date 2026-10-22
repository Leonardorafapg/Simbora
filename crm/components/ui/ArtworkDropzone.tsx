"use client";

import { useRef, useState } from "react";
import { FileText } from "lucide-react";
import { uploadArtwork } from "@/services/client/uploadsApi";
import { isImageUrl } from "@/lib/artwork";
import ImageDropzone from "@/components/ui/ImageDropzone";

type Props = {
  value: string | null;
  onChange: (url: string | null) => void;
};

const ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip";

/**
 * Arte final do post: aceita imagem (com preview, via ImageDropzone) ou
 * documento (PDF, Word, Excel, PowerPoint, ZIP), mostrado como link.
 */
export default function ArtworkDropzone({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined | null) {
    setError(null);
    if (!file) return;
    setUploading(true);
    try {
      onChange(await uploadArtwork(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o arquivo.");
    } finally {
      setUploading(false);
    }
  }

  if (value && isImageUrl(value)) {
    return <ImageDropzone value={value} onChange={onChange} />;
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-3">
        <FileText className="h-5 w-5 shrink-0 text-text-muted" />
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1 truncate text-xs text-cyan hover:underline"
        >
          Abrir documento
        </a>
        <button type="button" onClick={() => onChange(null)} className="text-xs text-danger hover:underline">
          Remover
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-disabled={uploading}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => !uploading && (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!uploading) handleFile(e.dataTransfer.files[0]);
        }}
        className={`rounded-lg border border-dashed px-3 py-6 text-center text-xs transition-colors ${
          uploading
            ? "border-border text-text-faint cursor-wait"
            : dragOver
              ? "border-cyan bg-cyan/5 text-cyan cursor-pointer"
              : "border-border text-text-faint hover:border-border-hover cursor-pointer"
        }`}
      >
        {uploading ? "Enviando arquivo..." : "Arraste uma imagem ou documento (PDF, Word, Excel, PowerPoint, ZIP) ou clique"}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          disabled={uploading}
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}
