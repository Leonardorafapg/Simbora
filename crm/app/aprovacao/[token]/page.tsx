"use client";

import { use, useEffect, useState } from "react";
import { decidirComoCliente, fetchApprovalByToken } from "@/services/client/calendarPeriodApi";
import { CALENDAR_PERIOD_STATUS_LABELS } from "@/types/calendarPeriod";
import type { CalendarApprovalPublic } from "@/types/calendarPeriod";
import { MONTH_LABELS } from "@/types/calendar";

export default function AprovacaoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [data, setData] = useState<CalendarApprovalPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    fetchApprovalByToken(token)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Link inválido ou expirado."))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleDecision(decision: "aprovado" | "reprovado") {
    if (decision === "reprovado" && !reason.trim()) {
      setShowReject(true);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const updated = await decidirComoCliente(token, decision, reason.trim() || undefined);
      setData(updated);
      setShowReject(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar a decisão.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <CenteredMessage>Carregando...</CenteredMessage>;
  }

  if (error && !data) {
    return <CenteredMessage>{error}</CenteredMessage>;
  }

  if (!data) {
    return <CenteredMessage>Link inválido ou expirado.</CenteredMessage>;
  }

  const monthLabel = MONTH_LABELS[data.month - 1] ?? String(data.month);
  const awaitingDecision = data.status === "enviado_aprovacao_cliente";
  const alreadyDecided = data.status === "finalizado" || data.status === "em_andamento";

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 text-white">
        <h1 className="text-xl font-bricolage font-semibold">Aprovação de calendário</h1>
        <p className="mt-1 text-white/70">
          {data.client_name} — {monthLabel}/{data.year}
        </p>

        {data.pdf_url && (
          <a
            href={data.pdf_url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/10"
          >
            Ver PDF do calendário
          </a>
        )}

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {awaitingDecision ? (
          <div className="mt-6 space-y-3">
            {!showReject ? (
              <div className="flex gap-3">
                <button
                  disabled={submitting}
                  onClick={() => handleDecision("aprovado")}
                  className="flex-1 rounded-lg bg-cyan px-4 py-2 font-medium text-dark disabled:opacity-50"
                >
                  ✅ Aprovar
                </button>
                <button
                  disabled={submitting}
                  onClick={() => setShowReject(true)}
                  className="flex-1 rounded-lg border border-red-400/40 px-4 py-2 font-medium text-red-400 disabled:opacity-50"
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
                  className="w-full rounded-lg bg-white/10 p-3 text-sm outline-none"
                  rows={3}
                />
                <div className="flex gap-3">
                  <button
                    disabled={submitting}
                    onClick={() => handleDecision("reprovado")}
                    className="flex-1 rounded-lg bg-red-400 px-4 py-2 font-medium text-dark disabled:opacity-50"
                  >
                    Enviar reprovação
                  </button>
                  <button
                    disabled={submitting}
                    onClick={() => setShowReject(false)}
                    className="rounded-lg border border-white/15 px-4 py-2 text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-6 rounded-lg bg-white/10 px-4 py-3 text-sm">
            {alreadyDecided
              ? `Status atual: ${CALENDAR_PERIOD_STATUS_LABELS[data.status]}.`
              : "Este calendário ainda não está disponível para aprovação."}
          </p>
        )}
      </div>
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-dark flex items-center justify-center p-6 text-white/70">
      {children}
    </div>
  );
}
