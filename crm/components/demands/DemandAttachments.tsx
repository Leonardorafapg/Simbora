"use client";

import { useEffect, useState } from "react";
import { Paperclip, X } from "lucide-react";
import type { CalendarEntry, DemandAssetsInput } from "@/types/calendar";
import ImageDropzone from "@/components/ui/ImageDropzone";
import MultiImageDropzone from "@/components/ui/MultiImageDropzone";

type Props = {
  entry: CalendarEntry | null;
  loading: boolean;
  error: string | null;
  canEdit: boolean;
  onSave: (input: DemandAssetsInput) => Promise<CalendarEntry>;
};

/**
 * Referência + material que o social enviou ao planejar a postagem — o
 * designer usa como insumo pra arte. Editável direto por aqui (arrastar e
 * soltar) quando `canEdit`, sem precisar voltar pro planejamento do
 * calendário: cada solto já salva sozinho, sem botão "salvar" separado —
 * é o mesmo comportamento de anexo do Trello.
 */
export default function DemandAttachments({ entry, loading, error, canEdit, onSave }: Props) {
  const [preview, setPreview] = useState<string | null>(null);

  // Sem UI de erro de propósito: o upload em si (ImageDropzone/MultiImageDropzone)
  // já mostra a falha inline quando acontece — isso aqui é só o carregamento
  // do estado atual, que não deve travar nem assustar quem só quer soltar um arquivo.
  useEffect(() => {
    if (error) console.error("[DemandAttachments] falha ao carregar anexos:", error);
  }, [error]);

  async function handleSave(input: DemandAssetsInput) {
    try {
      await onSave(input);
    } catch (err) {
      console.error("[DemandAttachments] falha ao salvar:", err);
    }
  }

  const readOnlyFiles = entry
    ? [...(entry.reference_image ? [entry.reference_image] : []), ...entry.material_files]
    : [];

  return (
    <div className="glass-card rounded-2xl p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Paperclip className="h-4 w-4 text-white/40" />
        Anexos
      </div>

      {loading && <p className="text-xs text-white/40">Carregando...</p>}

      {!loading && !error && !canEdit && (
        <>
          {readOnlyFiles.length === 0 && (
            <p className="text-xs text-white/40">O social ainda não enviou referência ou material.</p>
          )}
          {readOnlyFiles.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {readOnlyFiles.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setPreview(url)}
                  className="rounded-lg overflow-hidden border border-white/10 h-24"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL externa (Cloudinary), sem loader configurado */}
                  <img
                    src={url}
                    alt={url === entry?.reference_image ? "Referência" : "Material"}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {!loading && canEdit && (
        <>
          <div>
            <p className="text-xs text-white/50 mb-1.5">Referência (post principal)</p>
            <ImageDropzone
              value={entry?.reference_image ?? null}
              onChange={(url) => handleSave({ reference_image: url })}
            />
          </div>

          <div>
            <p className="text-xs text-white/50 mb-1.5">Material</p>
            <MultiImageDropzone
              value={entry?.material_files ?? []}
              onChange={(urls) => handleSave({ material_files: urls })}
            />
          </div>
        </>
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
