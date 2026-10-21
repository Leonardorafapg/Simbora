"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPendingApprovals } from "@/services/client/calendarPeriodApi";
import type { CalendarPeriodPending } from "@/types/calendarPeriod";

/** Caixa de entrada central de aprovações — ver GET /calendar-periods/pending-approval. */
export function usePendingApprovals() {
  const [items, setItems] = useState<CalendarPeriodPending[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPendingApprovals();
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, error, refresh: load };
}
