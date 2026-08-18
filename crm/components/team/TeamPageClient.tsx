"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import type { TeamMember } from "@/types/team";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import TeamMemberGrid from "./TeamMemberGrid";
import TeamMemberDrawer from "./TeamMemberDrawer";
import NewTeamMemberDialog from "./NewTeamMemberDialog";

type Props = {
  canManage: boolean;
  canViewDemands: boolean;
};

export default function TeamPageClient({ canManage, canViewDemands }: Props) {
  const { members, loading, error, create, update, remove } = useTeamMembers();
  const searchParams = useSearchParams();

  // Guardamos o id, não o objeto: assim o drawer sempre reflete a versão mais
  // recente da lista depois de uma edição (e fecha sozinho após a remoção).
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Permite abrir um membro direto via link (usado pela busca geral da topbar).
  useEffect(() => {
    const openMember = searchParams.get("openMember");
    if (openMember) setSelectedId(Number(openMember));
  }, [searchParams]);
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const selected = members.find((member) => member.id === selectedId) ?? null;

  async function handleConfirmDelete() {
    if (!pendingDelete) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await remove(pendingDelete.id);
      setPendingDelete(null);
      setSelectedId(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Erro ao remover.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="relative h-full p-6 sm:p-8">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <h1 className="text-2xl font-semibold text-white">Equipe</h1>
        {canManage && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-dark"
          >
            + Novo membro
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-white/50">Carregando...</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {deleteError && <p className="mb-4 text-sm text-danger">{deleteError}</p>}

      <TeamMemberGrid
        members={members}
        canManage={canManage}
        onSelect={(member) => setSelectedId(member.id)}
        onAddClick={() => setAddOpen(true)}
      />

      <TeamMemberDrawer
        member={selected}
        canManage={canManage}
        canViewDemands={canViewDemands}
        onClose={() => setSelectedId(null)}
        onUpdate={update}
        onRequestDelete={setPendingDelete}
      />

      <NewTeamMemberDialog open={addOpen} onClose={() => setAddOpen(false)} onCreate={create} />

      {/* Fora do drawer de propósito: `transform` cria containing block e
          prenderia o overlay `fixed` à área do painel. */}
      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Remover ${pendingDelete?.full_name ?? ""}?`}
        description="Essa ação exclui o acesso do membro à equipe permanentemente."
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
