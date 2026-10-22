"use client";

import { useState } from "react";
import { buildCalendarPdfBlob } from "@/lib/calendarPdf";
import { uploadDocument } from "@/services/client/uploadsApi";
import { decidirComoAmanda, enviarParaAprovacao } from "@/services/client/calendarPeriodApi";
import type { CalendarEntry } from "@/types/calendar";
import type { CalendarPeriodStatus } from "@/types/calendarPeriod";

type Props = {
  clientId: number;
  clientName: string;
  year: number;
  month: number;
  monthLabel: string;
  status: CalendarPeriodStatus;
  entries: CalendarEntry[];
  /** Pode mandar o mês pra aprovação (mesma permissão de editar o calendário). */
  canSend: boolean;
  /** Pode decidir a etapa interna da Amanda. */
  canApprove: boolean;
  /** PDF já gerado dessa rodada — mostra um link "Ver PDF" pra revisar antes de decidir. */
  pdfUrl?: string | null;
  onChanged: () => void;
};

/**
 * Painel de ações do fluxo de aprovação (ver docs/plano-aprovacao-calendario.md):
 * time manda pra aprovação da Amanda; Amanda aprova/reprova; ao aprovar, o PDF
 * sai automaticamente pro WhatsApp do cliente com o link de aprovação dele.
 */
export default function CalendarApprovalPanel({
  clientId,
  clientName,
  year,
  month,
  monthLabel,
  status,
  entries,
  canSend,
  canApprove,
  pdfUrl,
  onChanged,
}: Props) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  async function handleEnviarParaAprovacao() {
    setError(null);
    setWorking(true);
    try {
      const blob = await buildCalendarPdfBlob(clientName, monthLabel, entries);
      const pdfUrl = await uploadDocument(blob);
      await enviarParaAprovacao(clientId, year, month, pdfUrl);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar para aprovação.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDecisaoAmanda(decision: "aprovado" | "reprovado") {
    if (decision === "reprovado" && !reason.trim()) {
      setShowReject(true);
      return;
    }
    setError(null);
    setWorking(true);
    try {
      await decidirComoAmanda(clientId, year, month, decision, reason.trim() || undefined);
      setShowReject(false);
      setReason("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar a decisão.");
    } finally {
      setWorking(false);
    }
  }

  if (status === "em_andamento" || status === "reprovado") {
    if (!canSend) return null;
    return (
      <div className="glass-card rounded-2xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-text">Mês pronto? Envie para a Amanda aprovar antes de ir pro cliente.</p>
        <div className="flex items-center gap-3">
          {error && <span className="text-sm text-danger">{error}</span>}
          <button
            type="button"
            disabled={working || entries.length === 0}
            onClick={handleEnviarParaAprovacao}
            className="rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-dark disabled:opacity-50"
          >
            {working ? "Gerando PDF..." : "Enviar para aprovação"}
          </button>
        </div>
      </div>
    );
  }

  if (status === "enviado_aprovacao_amanda") {
    if (!canApprove) {
      return (
        <div className="glass-card rounded-2xl px-4 py-3 text-sm text-text">
          Aguardando a aprovação da Amanda.
        </div>
      );
    }
    return (
      <div className="glass-card rounded-2xl px-4 py-3 space-y-3">
        <p className="text-sm text-text">Este mês está aguardando a sua aprovação.</p>
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-sm text-cyan underline">
            Ver PDF do cronograma
          </a>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        {!showReject ? (
          <div className="flex gap-3">
            <button
              type="button"
              disabled={working}
              onClick={() => handleDecisaoAmanda("aprovado")}
              className="rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              ✅ Aprovar e enviar ao cliente
            </button>
            <button
              type="button"
              disabled={working}
              onClick={() => setShowReject(true)}
              className="rounded-lg border border-red-400/40 px-4 py-2 text-sm font-semibold text-red-400 disabled:opacity-50"
            >
              ❌ Reprovar
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="O que precisa ajustar?"
              className="glass-input w-full rounded-lg p-3 text-sm outline-none"
              rows={3}
            />
            <div className="flex gap-3">
              <button
                type="button"
                disabled={working}
                onClick={() => handleDecisaoAmanda("reprovado")}
                className="rounded-lg bg-red-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              >
                Enviar reprovação
              </button>
              <button
                type="button"
                disabled={working}
                onClick={() => setShowReject(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (status === "enviado_aprovacao_cliente") {
    return (
      <div className="glass-card rounded-2xl px-4 py-3 text-sm text-text">
        Aprovado pela Amanda — aguardando aprovação do cliente (PDF enviado no WhatsApp).
      </div>
    );
  }

  return null;
}
