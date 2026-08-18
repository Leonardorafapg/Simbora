"use client";

import { useState } from "react";
import { useDemands } from "@/hooks/useDemands";
import { useClients } from "@/hooks/useClients";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import type { Demand, DemandFilters as Filters, DemandStatus } from "@/types/demand";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DemandAnalytics from "./DemandAnalytics";
import DemandFilters from "./DemandFilters";
import DemandTable from "./DemandTable";
import DemandKanban from "./DemandKanban";
import DemandDialog from "./DemandDialog";

type Props = {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export default function ProductionPageClient({ canCreate, canEdit, canDelete }: Props) {
  const [filters, setFilters] = useState<Filters>({ status: "pendente" });
  const [view, setView] = useState<"tabela" | "kanban">("kanban");
  const [selected, setSelected] = useState<Demand | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Demand | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const { demands, loading, error, create, update, remove } = useDemands(filters);
  // Analytics são um resumo global — não devem encolher junto quando o
  // usuário filtra por cliente/responsável, senão os números "mentem".
  const { demands: allDemands } = useDemands({});
  const { clients } = useClients();
  const { members: teamMembers } = useTeamMembers();

  function openEdit(demand: Demand) {
    setSelected(demand);
  }

  function requestDelete(demand: Demand) {
    setSelected(null);
    setPendingDelete(demand);
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await remove(pendingDelete.id);
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Erro ao remover.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleQuickStatusChange(demand: Demand, status: DemandStatus) {
    setStatusError(null);
    try {
      await update(demand.id, { status });
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Erro ao atualizar status.");
    }
  }

  return (
    <div className="relative h-full p-6 sm:p-8 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold text-white">Produção</h1>
      </div>

      <DemandAnalytics demands={allDemands} />

      <DemandFilters
        filters={filters}
        onChangeFilters={setFilters}
        clients={clients}
        teamMembers={teamMembers}
        view={view}
        onChangeView={setView}
        canCreate={canCreate}
        onAddClick={() => setAddOpen(true)}
      />

      {loading && <p className="text-sm text-white/50">Carregando...</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {deleteError && <p className="text-sm text-danger">{deleteError}</p>}
      {statusError && <p className="text-sm text-danger">{statusError}</p>}

      {view === "tabela" ? (
        <DemandTable demands={demands} clients={clients} teamMembers={teamMembers} onSelect={openEdit} />
      ) : (
        <DemandKanban
          demands={demands}
          clients={clients}
          teamMembers={teamMembers}
          canEdit={canEdit}
          onSelect={openEdit}
          onChangeStatus={handleQuickStatusChange}
        />
      )}

      <DemandDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        clients={clients}
        teamMembers={teamMembers}
        onCreate={create}
        onUpdate={update}
      />

      <DemandDialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        demand={selected}
        clients={clients}
        teamMembers={teamMembers}
        canDelete={canDelete}
        onCreate={create}
        onUpdate={update}
        onRequestDelete={requestDelete}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Remover "${pendingDelete?.title ?? ""}"?`}
        description="Essa ação remove a demanda permanentemente."
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
