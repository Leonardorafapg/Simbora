"use client";

import { useEffect, useState } from "react";
import { ImagePlus } from "lucide-react";
import type { CalendarEntry, DeliverableInput } from "@/types/calendar";
import ImageDropzone from "@/components/ui/ImageDropzone";

type Props = {
  entry: CalendarEntry | null;
  loading: boolean;
  error: string | null;
  canEdit: boolean;
  onSave: (input: DeliverableInput) => Promise<CalendarEntry>;
};

/** Onde o designer entrega a arte final + legenda dessa demanda. */
export default function DemandDeliverable({ entry, loading, error, canEdit, onSave }: Props) {
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sincroniza com o que veio do servidor só enquanto não há edição local
  // pendente — evita sobrescrever o que a pessoa está digitando.
  useEffect(() => {
    if (entry && !dirty) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza o form com o que veio do servidor até a pessoa começar a editar
      setFinalImage(entry.final_image);
      setCaption(entry.caption ?? "");
    }
  }, [entry, dirty]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({ final_image: finalImage, caption });
      setDirty(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass-card rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <ImagePlus className="h-4 w-4 text-white/40" />
        Entrega
      </div>

      {loading && <p className="text-xs text-white/40">Carregando...</p>}
      {error && <p className="text-xs text-danger">{error}</p>}

      {!loading && !error && (
        <>
          <div>
            <p className="text-xs text-white/50 mb-1.5">Imagem final</p>
            {canEdit ? (
              <ImageDropzone
                value={finalImage}
                onChange={(url) => {
                  setFinalImage(url);
                  setDirty(true);
                }}
              />
            ) : finalImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL externa (Cloudinary), sem loader configurado
              <img src={finalImage} alt="Arte final" className="w-full max-h-40 object-cover rounded-lg" />
            ) : (
              <p className="text-xs text-white/40">Ainda não entregue.</p>
            )}
          </div>

          <div>
            <p className="text-xs text-white/50 mb-1.5">Legenda</p>
            {canEdit ? (
              <textarea
                value={caption}
                onChange={(e) => {
                  setCaption(e.target.value);
                  setDirty(true);
                }}
                placeholder="Legenda que vai junto com a postagem"
                className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full min-h-[80px]"
              />
            ) : (
              <p className="text-sm text-white/80 whitespace-pre-wrap">{caption || "Sem legenda ainda."}</p>
            )}
          </div>

          {saveError && <p className="text-xs text-danger">{saveError}</p>}

          {canEdit && (
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className="rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-dark disabled:opacity-40"
            >
              {saving ? "Salvando..." : "Salvar entrega"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
