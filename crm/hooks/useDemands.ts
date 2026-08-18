"use client";

import { useEffect, useState } from "react";
import { createDemand, deleteDemand, fetchDemands, updateDemand } from "@/services/client/demandApi";
import type { Demand, DemandCreateInput, DemandFilters, DemandUpdateInput } from "@/types/demand";

const byDueDate = (a: Demand, b: Demand) => {
  if (!a.due_date && !b.due_date) return 0;
  if (!a.due_date) return 1;
  if (!b.due_date) return -1;
  return a.due_date.localeCompare(b.due_date);
};

export function useDemands(filters: DemandFilters) {
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Serializado pra dependência estável do effect (objeto novo a cada render).
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const data = await fetchDemands(filters);
        if (cancelled) return;
        setDemands([...data].sort(byDueDate));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filterKey já representa `filters`
  }, [filterKey]);

  async function create(input: DemandCreateInput) {
    const demand = await createDemand(input);
    setDemands((prev) => [...prev, demand].sort(byDueDate));
    return demand;
  }

  async function update(id: number, input: DemandUpdateInput) {
    const demand = await updateDemand(id, input);
    setDemands((prev) => prev.map((d) => (d.id === id ? demand : d)).sort(byDueDate));
    return demand;
  }

  async function remove(id: number) {
    await deleteDemand(id);
    setDemands((prev) => prev.filter((d) => d.id !== id));
  }

  return { demands, loading, error, create, update, remove };
}
