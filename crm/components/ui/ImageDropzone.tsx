"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { uploadImage } from "@/services/client/uploadsApi";

type Props = {
  /** URL da imagem já enviada ao Cloudinary — não é mais base64. */
  value: string | null;
  onChange: (url: string | null) => void;
};

const MAX_SIZE_MB = 5;

export default function ImageDropzone({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);

  async function handleFile(file: File | undefined | null) {
    setError(null);
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Imagem muito grande (máx. ${MAX_SIZE_MB}MB).`);
      return;
    }

    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
    }
  }

  if (value) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setPreview(true)}
          className="block w-full rounded-lg overflow-hidden border border-white/10"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- URL externa (Cloudinary), sem loader configurado */}
          <img src={value} alt="Referência" className="w-full max-h-40 object-cover" />
        </button>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setPreview(true)} className="text-xs text-cyan hover:underline">
            Ver imagem
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-auto text-xs text-danger hover:underline"
          >
            Remover
          </button>
        </div>

        {preview && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
            onClick={() => setPreview(false)}
          >
            <button
              type="button"
              onClick={() => setPreview(false)}
              className="absolute top-4 right-4 text-white/70 hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-6 w-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element -- URL externa (Cloudinary), sem loader configurado */}
            <img src={value} alt="Referência" className="max-w-full max-h-full rounded-lg" />
          </div>
        )}
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
            ? "border-white/10 text-white/30 cursor-wait"
            : dragOver
              ? "border-cyan bg-cyan/5 text-cyan cursor-pointer"
              : "border-white/15 text-white/40 hover:border-white/25 cursor-pointer"
        }`}
      >
        {uploading ? "Enviando imagem..." : "Arraste uma imagem aqui ou clique para selecionar"}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          disabled={uploading}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}
