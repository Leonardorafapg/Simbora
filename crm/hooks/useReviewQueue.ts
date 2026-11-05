"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchCalendarEntries, fetchReviewsBatch, updateCalendarEntry } from "@/services/client/calendarApi";
import { REVIEW_STAGE } from "@/lib/postReview";
import type { CalendarEntry, CalendarEntryReview } from "@/types/calendar";

// Outra pessoa pode mexer nos posts (designer puxa de volta, outra revisora decide): a fila se corrige sozinha.
const POLL_MS = 30_000;

/** Posts na "Checagem e aprovação" (de todos os clientes e meses), com aprovar e pedir ajustes. */
export function useReviewQueue() {
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [reviews, setReviews] = useState<Record<number, CalendarEntryReview[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchCalendarEntries({ status: REVIEW_STAGE });
      setEntries(data);
      // Histórico de todos numa chamada só; se falhar, a fila segue sem ele.
      setReviews(await fetchReviewsBatch(data.map((e) => e.id)).catch(() => ({})));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fora do corpo síncrono do efeito: o setState de `refresh` só acontece depois do await.
    const first = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh]);

  // Decide só se o post ainda está na checagem: o backend recusa (409) se mudou, e a fila é recarregada.
  async function decide(entry: CalendarEntry, input: { status: "finalizados" | "modificacoes"; review_reason?: string }) {
    try {
      await updateCalendarEntry(entry.id, { ...input, expected_status: REVIEW_STAGE });
    } catch (err) {
      await refresh();
      throw err;
    }
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
  }

  const approve = (entry: CalendarEntry) => decide(entry, { status: "finalizados" });
  const requestChanges = (entry: CalendarEntry, reason: string) =>
    decide(entry, { status: "modificacoes", review_reason: reason });

  return { entries, reviews, loading, error, refresh, approve, requestChanges };
}
