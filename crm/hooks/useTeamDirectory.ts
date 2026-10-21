"use client";

import { useEffect, useState } from "react";
import { fetchTeamDirectory } from "@/services/client/teamApi";
import { getOrFetch } from "@/lib/dataCache";
import type { TeamDirectoryEntry } from "@/types/team";

const byName = (a: TeamDirectoryEntry, b: TeamDirectoryEntry) => a.full_name.localeCompare(b.full_name);

/**
 * Diretório enxuto da equipe — ao contrário de useTeamMembers (que exige
 * admin, /users), este endpoint é liberado pra qualquer usuário autenticado.
 * Usar aqui sempre que o objetivo for só atribuir/filtrar (requester/assignee),
 * nunca administrar a equipe (isso continua em useTeamMembers/TeamPageClient).
 */
export function useTeamDirectory() {
  const [members, setMembers] = useState<TeamDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await getOrFetch("teamDirectory", fetchTeamDirectory);
        if (cancelled) return;
        setMembers([...data].sort(byName));
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

  return { members, loading, error };
}
