"use client";

import { useEffect, useState } from "react";
import { monthWindow, overlapsMonth } from "@/lib/agenda";
import { createAgendaEvent, deleteAgendaEvent, fetchAgendaEvents, updateAgendaEvent } from "@/services/client/agendaApi";
import type { AgendaEvent, AgendaEventInput } from "@/types/agenda";

const byStart = (a: AgendaEvent, b: AgendaEvent) => a.starts_at.localeCompare(b.starts_at) || a.id - b.id;

/** Compromissos do mês (`month` de 1 a 12) do usuário logado. */
export function useAgenda(year: number, month: number) {
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { start, end } = monthWindow(year, month);
        const data = await fetchAgendaEvents(start, end);
        if (cancelled) return;
        setEvents(data);
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
  }, [year, month]);

  async function create(input: AgendaEventInput) {
    const event = await createAgendaEvent(input);
    if (overlapsMonth(event, year, month)) setEvents((prev) => [...prev, event].sort(byStart));
    return event;
  }

  async function update(id: number, input: Partial<AgendaEventInput>) {
    const event = await updateAgendaEvent(id, input);
    // Mudou pra outro mês: sai da tela atual (aparece quando a pessoa navegar até lá).
    setEvents((prev) =>
      overlapsMonth(event, year, month) ? prev.map((e) => (e.id === id ? event : e)).sort(byStart) : prev.filter((e) => e.id !== id),
    );
    return event;
  }

  async function remove(id: number) {
    await deleteAgendaEvent(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  return { events, loading, error, create, update, remove };
}
