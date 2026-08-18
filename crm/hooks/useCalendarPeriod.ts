"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchCalendarPeriod, setCalendarPeriodStatus } from "@/services/client/calendarPeriodApi";
import type { CalendarPeriod, CalendarPeriodStatus } from "@/types/calendarPeriod";

/** Status de um cliente/mês inteiro no cronograma — não confundir com uma postagem. */
export function useCalendarPeriod(clientId: number, year: number, month: number) {
  const [period, setPeriod] = useState<CalendarPeriod>({ client_id: clientId, year, month, status: "em_andamento" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const data = await fetchCalendarPeriod(clientId, year, month);
        if (cancelled) return;
        setPeriod(data);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro inesperado.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, year, month]);

  const setStatus = useCallback(
    async (status: CalendarPeriodStatus) => {
      const updated = await setCalendarPeriodStatus(clientId, year, month, status);
      setPeriod(updated);
      return updated;
    },
    [clientId, year, month],
  );

  return { period, loading, error, setStatus };
}
