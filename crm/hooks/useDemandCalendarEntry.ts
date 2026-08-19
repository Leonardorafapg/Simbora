"use client";

import { useEffect, useState } from "react";
import { fetchDemandCalendarEntry, updateDemandDeliverable } from "@/services/client/demandApi";
import type { CalendarEntry, DeliverableInput } from "@/types/calendar";

/** Busca a postagem vinculada a uma demanda só quando ela tem `calendar_entry_id`. */
export function useDemandCalendarEntry(demandId: number, hasCalendarEntry: boolean) {
  const [entry, setEntry] = useState<CalendarEntry | null>(null);
  const [loading, setLoading] = useState(hasCalendarEntry);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasCalendarEntry) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reseta o estado quando a demanda deixa de ter postagem vinculada
      setEntry(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchDemandCalendarEntry(demandId)
      .then((data) => {
        if (!cancelled) {
          setEntry(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro inesperado.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [demandId, hasCalendarEntry]);

  async function saveDeliverable(input: DeliverableInput) {
    const updated = await updateDemandDeliverable(demandId, input);
    setEntry(updated);
    return updated;
  }

  return { entry, loading, error, saveDeliverable };
}
