"use client";

import { useEffect, useState } from "react";
import { createClient, deleteClient, fetchClients, updateClient } from "@/services/client/clientApi";
import type { Client, ClientCreateInput, ClientUpdateInput } from "@/types/client";

const byName = (a: Client, b: Client) => a.name.localeCompare(b.name);

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const clientsData = await fetchClients();
        if (cancelled) return;
        setClients([...clientsData].sort(byName));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro inesperado.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function create(input: ClientCreateInput) {
    const client = await createClient(input);
    setClients((prev) => [...prev, client].sort(byName));
    return client;
  }

  async function update(id: number, input: ClientUpdateInput) {
    const client = await updateClient(id, input);
    setClients((prev) => prev.map((c) => (c.id === id ? client : c)).sort(byName));
    return client;
  }

  async function remove(id: number) {
    await deleteClient(id);
    setClients((prev) => prev.filter((c) => c.id !== id));
  }

  return { clients, loading, error, create, update, remove };
}
