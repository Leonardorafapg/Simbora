"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useClients } from "@/hooks/useClients";
import { useTeamDirectory } from "@/hooks/useTeamDirectory";
import type { Client } from "@/types/client";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import MultiSelect from "@/components/ui/MultiSelect";
import ClientGrid from "./ClientGrid";
import ClientDrawer from "./ClientDrawer";
import NewClientDialog from "./NewClientDialog";

type CalendarPermissions = { canCreate: boolean; canEdit: boolean; canDelete: boolean; canApprove: boolean };
type InstagramPermissions = { canView: boolean; canManage: boolean };

type Props = {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  calendarPermissions: CalendarPermissions;
  instagramPermissions: InstagramPermissions;
};

export default function ClientPageClient({
  canCreate,
  canEdit,
  canDelete,
  calendarPermissions,
  instagramPermissions,
}: Props) {
  const { clients, loading, error, create, update, remove } = useClients();
  const { members: teamMembers } = useTeamDirectory();
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
  // Filtro por responsável: o cliente aparece se o social OU o designer padrão estiver entre os escolhidos.
  const [responsibleIds, setResponsibleIds] = useState<number[]>([]);
  const [pendingDelete, setPendingDelete] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const selected = clients.find((client) => client.id === selectedId) ?? null;

  const visibleClients =
    responsibleIds.length === 0
      ? clients
      : clients.filter(
          (client) =>
            (client.default_social_id !== null && responsibleIds.includes(client.default_social_id)) ||
            (client.default_designer_id !== null && responsibleIds.includes(client.default_designer_id)),
        );

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
    <div className="relative h-full overflow-x-clip">
      {/* A página rola aqui dentro; o painel (drawer) fica fora da rolagem para sempre cobrir a área visível. */}
      <div className="h-full overflow-y-auto p-6 sm:p-8">
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

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <MultiSelect
            options={teamMembers.map((m) => ({ value: m.id, label: m.full_name }))}
            value={responsibleIds}
            onChange={setResponsibleIds}
            allLabel="Todos os responsáveis"
            pluralLabel="responsáveis"
            ariaLabel="Filtrar por responsável"
          />
          {responsibleIds.length > 0 && (
            <span className="text-xs text-white/50">
              {visibleClients.length} de {clients.length} clientes
            </span>
          )}
        </div>

        {loading && <p className="text-sm text-white/50">Carregando...</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
        {deleteError && <p className="mb-4 text-sm text-danger">{deleteError}</p>}

        <ClientGrid
          clients={visibleClients}
          teamMembers={teamMembers}
          canCreate={canCreate}
          onSelect={(client) => setSelectedId(client.id)}
          onAddClick={() => setAddOpen(true)}
        />
      </div>

      <ClientDrawer
        client={selected}
        canEdit={canEdit}
        canDelete={canDelete}
        teamMembers={teamMembers}
        calendarPermissions={calendarPermissions}
            instagramPermissions={instagramPermissions}
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
