"use client";

import { useEffect, useState } from "react";
import { createTeamMember, deleteTeamMember, fetchTeamMembers, updateTeamMember } from "@/services/client/teamApi";
import type { TeamMember, TeamMemberCreateInput, TeamMemberUpdateInput } from "@/types/team";

const byName = (a: TeamMember, b: TeamMember) => a.full_name.localeCompare(b.full_name);

export function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carrega a equipe de uma vez só; o drawer de detalhe consome esse estado,
  // sem nova requisição ao abrir.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const membersData = await fetchTeamMembers();
        if (cancelled) return;
        setMembers([...membersData].sort(byName));
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

  async function create(input: TeamMemberCreateInput) {
    const member = await createTeamMember(input);
    setMembers((prev) => [...prev, member].sort(byName));
    return member;
  }

  async function update(id: number, input: TeamMemberUpdateInput) {
    const member = await updateTeamMember(id, input);
    setMembers((prev) => prev.map((m) => (m.id === id ? member : m)).sort(byName));
    return member;
  }

  async function remove(id: number) {
    await deleteTeamMember(id);
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  return { members, loading, error, create, update, remove };
}
