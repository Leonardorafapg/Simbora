"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { uploadImage } from "@/services/client/uploadsApi";

type Props = {
  /** URLs já enviadas ao Cloudinary. */
  value: string[];
  onChange: (urls: string[]) => void;
};

const MAX_SIZE_MB = 5;

export default function MultiImageDropzone({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleFiles(fileList: FileList | null) {
    setError(null);
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    const invalid = files.find((f) => !f.type.startsWith("image/"));
    if (invalid) {
      setError("Selecione apenas arquivos de imagem.");
      return;
    }
    const tooBig = files.find((f) => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (tooBig) {
      setError(`Imagem muito grande (máx. ${MAX_SIZE_MB}MB): ${tooBig.name}`);
      return;
    }

    setUploading(true);
    try {
      // Sequencial, não paralelo: mantém o backend/Cloudinary sob controle
      // quando alguém solta 5-10 fotos de uma vez.
      const uploaded: string[] = [];
      for (const file of files) {
        uploaded.push(await uploadImage(file));
      }
      onChange([...value, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
    }
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {value.map((url, index) => (
            <div key={url} className="relative group rounded-lg overflow-hidden border border-white/10">
              <button type="button" onClick={() => setPreview(url)} className="block w-full h-20">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL externa (Cloudinary), sem loader configurado */}
                <img src={url} alt="Material" className="w-full h-full object-cover" />
              </button>
              <button
                type="button"
                onClick={() => removeAt(index)}
                className="absolute top-1 right-1 rounded-full bg-black/70 p-1 text-white/80 opacity-0 group-hover:opacity-100 hover:text-danger transition-opacity"
                aria-label="Remover"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

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
          if (!uploading) handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-lg border border-dashed px-3 py-4 text-center text-xs transition-colors ${
          uploading
            ? "border-white/10 text-white/30 cursor-wait"
            : dragOver
              ? "border-cyan bg-cyan/5 text-cyan cursor-pointer"
              : "border-white/15 text-white/40 hover:border-white/25 cursor-pointer"
        }`}
      >
        {uploading ? "Enviando..." : "Arraste imagens aqui ou clique para selecionar (pode escolher várias)"}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          disabled={uploading}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      {error && <p className="text-xs text-danger mt-1">{error}</p>}

      {preview && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-6 w-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- URL externa (Cloudinary), sem loader configurado */}
          <img src={preview} alt="Material" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
