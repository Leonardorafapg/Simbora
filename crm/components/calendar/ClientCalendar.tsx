"use client";

import { useState } from "react";
import { useCalendarEntries } from "@/hooks/useCalendarEntries";
import { useCalendarPeriod } from "@/hooks/useCalendarPeriod";
import type { CalendarEntry } from "@/types/calendar";
import { MONTH_LABELS } from "@/types/calendar";
import type { CalendarPeriodStatus } from "@/types/calendarPeriod";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import CalendarMonthView from "./CalendarMonthView";
import CalendarEntryDialog from "./CalendarEntryDialog";
import CalendarPeriodControl from "./CalendarPeriodControl";
import CalendarApprovalPanel from "./CalendarApprovalPanel";
import CalendarReport from "./CalendarReport";
import { todayLocalISO } from "@/lib/format";

type Props = {
  clientId: number;
  clientName: string;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** Decidir pela Amanda na etapa interna de aprovação (permissão separada de canEdit). */
  canApprove: boolean;
  /** Mês/ano são controlados por quem renderiza (ex.: ClientDetail usa pra filtrar "demandas do mês" pelo mesmo período mostrado aqui). */
  year: number;
  month: number;
  onChangeMonth: (year: number, month: number) => void;
};

/** Calendário de postagens de um único cliente — vive dentro do drawer de detalhe. */
export default function ClientCalendar({
  clientId,
  clientName,
  canCreate,
  canEdit,
  canDelete,
  canApprove,
  year,
  month,
  onChangeMonth,
}: Props) {
  const today = new Date();
  const [view, setView] = useState<"calendario" | "relatorio">("calendario");
  const [dialogDate, setDialogDate] = useState(todayLocalISO(today));
  const [dialogEntry, setDialogEntry] = useState<CalendarEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CalendarEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [savingPeriod, setSavingPeriod] = useState(false);
  const [periodError, setPeriodError] = useState<string | null>(null);

  const monthStr = `${year}-${String(month).padStart(2, "0")}`;
  const monthLabel = `${MONTH_LABELS[month - 1]} ${year}`;
  // Falha ao listar (ou mês sem nenhuma postagem) são o mesmo estado pra UI:
  // `entries` fica `[]` e o calendário renderiza normal — sem banner de erro.
  const { entries, create, update, remove } = useCalendarEntries(clientId, monthStr);
  const { period, setStatus: setPeriodStatus, refresh: refreshPeriod } = useCalendarPeriod(clientId, year, month);


  function openCreateDialog(date: string) {
    setDialogDate(date);
    setDialogEntry(null);
    setDialogOpen(true);
  }

  function openEditDialog(entry: CalendarEntry) {
    setDialogDate(entry.scheduled_date);
    setDialogEntry(entry);
    setDialogOpen(true);
  }

  function requestDelete(entry: CalendarEntry) {
    setDialogOpen(false);
    setPendingDelete(entry);
  }

  async function handlePeriodStatusChange(status: CalendarPeriodStatus) {
    setPeriodError(null);
    setSavingPeriod(true);
    try {
      await setPeriodStatus(status);
    } catch (err) {
      setPeriodError(err instanceof Error ? err.message : "Erro ao atualizar status.");
    } finally {
      setSavingPeriod(false);
    }
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

  return (
    <div className="space-y-4">
      <CalendarPeriodControl
        status={period.status}
        canManage={canEdit}
        saving={savingPeriod}
        onChange={handlePeriodStatusChange}
      />

      <CalendarApprovalPanel
        clientId={clientId}
        year={year}
        month={month}
        status={period.status}
        entries={entries}
        canSend={canEdit}
        canApprove={canApprove}
        onChanged={refreshPeriod}
      />

      {periodError && <p className="text-sm text-danger">{periodError}</p>}
      {deleteError && <p className="text-sm text-danger">{deleteError}</p>}

      {view === "calendario" ? (
        <CalendarMonthView
          year={year}
          month={month}
          entries={entries}
          canCreate={canCreate}
          canEdit={canEdit}
          onCreateDate={openCreateDialog}
          onEditEntry={openEditDialog}
          onChangeMonth={onChangeMonth}
          onOpenReport={() => setView("relatorio")}
        />
      ) : (
        <CalendarReport
          clientName={clientName}
          monthLabel={monthLabel}
          entries={entries}
          onClose={() => setView("calendario")}
        />
      )}

      {dialogOpen && (
        <CalendarEntryDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          clientId={clientId}
          defaultDate={dialogDate}
          entry={dialogEntry}
          canDelete={canDelete}
          onCreate={create}
          onUpdate={update}
          onRequestDelete={requestDelete}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remover postagem?"
        description="Essa ação remove a entrada do calendário permanentemente."
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
