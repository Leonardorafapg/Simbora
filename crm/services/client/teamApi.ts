import type { TeamMember, TeamMemberCreateInput, TeamMemberUpdateInput } from "@/types/team";

async function parseErrorMessage(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return data.message ?? fallback;
}

export async function fetchTeamMembers(): Promise<TeamMember[]> {
  const res = await fetch("/api/team");
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível carregar a equipe."));
  return res.json();
}

export async function createTeamMember(input: TeamMemberCreateInput): Promise<TeamMember> {
  const res = await fetch("/api/team", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível cadastrar o membro."));
  return res.json();
}

export async function updateTeamMember(id: number, input: TeamMemberUpdateInput): Promise<TeamMember> {
  const res = await fetch(`/api/team/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível salvar as alterações."));
  return res.json();
}

export async function deleteTeamMember(id: number): Promise<void> {
  const res = await fetch(`/api/team/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível remover o membro."));
}
