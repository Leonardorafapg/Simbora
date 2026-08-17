"use client";

import { useEffect, useState } from "react";
import {
  createCalendarEntry,
  deleteCalendarEntry,
  fetchCalendarEntries,
  updateCalendarEntry,
} from "@/services/client/calendarApi";
import type { CalendarEntry, CalendarEntryCreateInput, CalendarEntryUpdateInput } from "@/types/calendar";

/** `month` no formato YYYY-MM. `clientId` undefined = todos os clientes. */
export function useCalendarEntries(clientId: number | undefined, month: string) {
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const data = await fetchCalendarEntries({ clientId, month });
        if (cancelled) return;
        setEntries(data);
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
  }, [clientId, month]);

  async function create(input: CalendarEntryCreateInput) {
    const entry = await createCalendarEntry(input);
    setEntries((prev) => [...prev, entry].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date)));
    return entry;
  }

  async function update(id: number, input: CalendarEntryUpdateInput) {
    const entry = await updateCalendarEntry(id, input);
    setEntries((prev) => prev.map((e) => (e.id === id ? entry : e)));
    return entry;
  }

  async function remove(id: number) {
    await deleteCalendarEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  return { entries, loading, error, create, update, remove };
}
