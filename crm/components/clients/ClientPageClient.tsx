"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useClients } from "@/hooks/useClients";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import type { Client } from "@/types/client";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ClientGrid from "./ClientGrid";
import ClientDrawer from "./ClientDrawer";
import NewClientDialog from "./NewClientDialog";

type CalendarPermissions = { canCreate: boolean; canEdit: boolean; canDelete: boolean };

type Props = {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canViewDemands: boolean;
  calendarPermissions: CalendarPermissions;
};

export default function ClientPageClient({
  canCreate,
  canEdit,
  canDelete,
  canViewDemands,
  calendarPermissions,
}: Props) {
  const { clients, loading, error, create, update, remove } = useClients();
  const { members: teamMembers } = useTeamMembers();
  const searchParams = useSearchParams();

  // Guardamos o id, não o objeto: assim o drawer sempre reflete a versão mais
  // recente da lista depois de uma edição (e fecha sozinho após a remoção).
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Permite abrir um cliente direto via link (usado pela busca geral da topbar).
  useEffect(() => {
    const openClient = searchParams.get("openClient");
    if (openClient) setSelectedId(Number(openClient));
  }, [searchParams]);
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const selected = clients.find((client) => client.id === selectedId) ?? null;

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
        <h1 className="text-2xl font-semibold text-white">Clientes</h1>
        {canCreate && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-dark"
          >
            + Novo cliente
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-white/50">Carregando...</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {deleteError && <p className="mb-4 text-sm text-danger">{deleteError}</p>}

      <ClientGrid
        clients={clients}
        canCreate={canCreate}
        onSelect={(client) => setSelectedId(client.id)}
        onAddClick={() => setAddOpen(true)}
      />

      <ClientDrawer
        client={selected}
        canEdit={canEdit}
        canDelete={canDelete}
        canViewDemands={canViewDemands}
        teamMembers={teamMembers}
        calendarPermissions={calendarPermissions}
        onClose={() => setSelectedId(null)}
        onUpdate={update}
        onRequestDelete={setPendingDelete}
      />

      <NewClientDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={create}
        teamMembers={teamMembers}
      />

      {/* Fora do drawer de propósito: `transform` cria containing block e
          prenderia o overlay `fixed` à área do painel. */}
      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Remover ${pendingDelete?.name ?? ""}?`}
        description="Essa ação exclui o cliente permanentemente."
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
