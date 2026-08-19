"use client";

import { useState } from "react";
import { Paperclip, X } from "lucide-react";
import type { CalendarEntry } from "@/types/calendar";

type Props = {
  entry: CalendarEntry | null;
  loading: boolean;
  error: string | null;
};

/**
 * Painel só-leitura com o que o social enviou ao planejar a postagem —
 * referência + material bruto — pro designer usar como insumo. Nunca
 * escreve nada: quem grava é o social, lá no planejamento do calendário.
 */
export default function DemandAttachments({ entry, loading, error }: Props) {
  const [preview, setPreview] = useState<string | null>(null);

  const files = entry ? [...(entry.reference_image ? [entry.reference_image] : []), ...entry.material_files] : [];

  return (
    <div className="glass-card rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Paperclip className="h-4 w-4 text-white/40" />
        Anexos
      </div>

      {loading && <p className="text-xs text-white/40">Carregando...</p>}
      {error && <p className="text-xs text-danger">{error}</p>}

      {!loading && !error && files.length === 0 && (
        <p className="text-xs text-white/40">O social ainda não enviou referência ou material.</p>
      )}

      {!loading && files.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {files.map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => setPreview(url)}
              className="rounded-lg overflow-hidden border border-white/10 h-24"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- URL externa (Cloudinary), sem loader configurado */}
              <img
                src={url}
                alt={index === 0 && entry?.reference_image === url ? "Referência" : "Material"}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

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
          <img src={preview} alt="Anexo" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
