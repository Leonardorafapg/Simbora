"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";

type Props = {
  value: string | null;
  onChange: (dataUri: string | null) => void;
};

const MAX_SIZE_MB = 5;

export default function ImageDropzone({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  function handleFile(file: File | undefined | null) {
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

    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.onerror = () => setError("Não foi possível ler a imagem.");
    reader.readAsDataURL(file);
  }

  if (value) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setPreview(true)}
          className="block w-full rounded-lg overflow-hidden border border-white/10"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- data URI, sem loader configurado */}
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
            {/* eslint-disable-next-line @next/next/no-img-element -- data URI, sem loader configurado */}
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
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        className={`rounded-lg border border-dashed px-3 py-6 text-center text-xs cursor-pointer transition-colors ${
          dragOver ? "border-cyan bg-cyan/5 text-cyan" : "border-white/15 text-white/40 hover:border-white/25"
        }`}
      >
        Arraste uma imagem aqui ou clique para selecionar
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}
