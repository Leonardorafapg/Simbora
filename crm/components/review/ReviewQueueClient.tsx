"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useReviewQueue } from "@/hooks/useReviewQueue";
import { useClients } from "@/hooks/useClients";
import { useTeamDirectory } from "@/hooks/useTeamDirectory";
import type { CalendarEntry } from "@/types/calendar";
import PageHeader from "@/components/ui/PageHeader";
import { TopProgress } from "@/components/ui/Skeleton";
import RejectReasonDialog from "@/components/production/RejectReasonDialog";
import ReviewCard from "./ReviewCard";

/**
 * Fila da redatora: todos os posts na "Checagem e aprovação", com arte, legenda e descrição à vista.
 * Decide aqui mesmo (aprovar ou pedir ajustes) sem abrir card por card na Produção.
 */
export default function ReviewQueueClient() {
  const { entries, reviews, loading, error, approve, requestChanges } = useReviewQueue();
  const { clients } = useClients();
  const { members } = useTeamDirectory();
  const highlightedId = Number(useSearchParams().get("demanda")) || null;
  const [rejecting, setRejecting] = useState<CalendarEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Quem espera há mais tempo primeiro (todos já estão "entregues", então prazo não separa ninguém);
  // sem data de entrega, pela data do post.
  const sorted = useMemo(
    () =>
      [...entries].sort(
        (a, b) =>
          (a.delivered_at ?? "9999").localeCompare(b.delivered_at ?? "9999") ||
          a.scheduled_date.localeCompare(b.scheduled_date),
      ),
    [entries],
  );

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Não foi possível concluir a revisão.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative space-y-4 p-4 sm:p-8">
      {loading && <TopProgress />}
      <PageHeader
        className="mb-0"
        title="Revisão"
        description={
          loading
            ? "Carregando os posts em checagem..."
            : `${entries.length} ${entries.length === 1 ? "post aguardando" : "posts aguardando"} sua revisão.`
        }
      />

      {error && <p className="text-sm text-danger">{error}</p>}
      {actionError && !rejecting && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {actionError}
        </p>
      )}

      {!loading && !error && entries.length === 0 && (
        <p className="text-sm text-text-muted">Nenhum post na checagem agora. Tudo revisado.</p>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {sorted.map((entry) => (
          <ReviewCard
            key={entry.id}
            entry={entry}
            client={clients.find((c) => c.id === entry.client_id)}
            assignee={members.find((m) => m.id === entry.assignee_id)}
            members={members}
            reviews={reviews[entry.id] ?? []}
            highlighted={entry.id === highlightedId}
            busy={busy}
            onApprove={() => run(() => approve(entry))}
            onRequestChanges={() => setRejecting(entry)}
          />
        ))}
      </div>

      {rejecting && (
        <RejectReasonDialog
          title={rejecting.title || rejecting.theme}
          loading={busy}
          error={actionError}
          onCancel={() => {
            setRejecting(null);
            setActionError(null);
          }}
          onConfirm={(reason) =>
            run(async () => {
              await requestChanges(rejecting, reason);
              setRejecting(null);
            })
          }
        />
      )}
    </div>
  );
}
