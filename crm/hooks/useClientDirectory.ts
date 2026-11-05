"use client";

import { useEffect, useState } from "react";
import { fetchClientDirectory } from "@/services/client/clientApi";
import { getOrFetch } from "@/lib/dataCache";
import type { ClientRef } from "@/types/client";

const byName = (a: ClientRef, b: ClientRef) => a.name.localeCompare(b.name);

/**
 * Clientes só pra exibir e escolher (nome, foto, responsáveis padrão). Usar nas telas do calendário:
 * ao contrário de useClients (/clients, que exige `client.view`), funciona pra quem só tem `calendar.view`.
 */
export function useClientDirectory() {
  const [clients, setClients] = useState<ClientRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getOrFetch("clientDirectory", fetchClientDirectory);
        if (!cancelled) setClients([...data].sort(byName));
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

  return { clients, loading, error };
}
