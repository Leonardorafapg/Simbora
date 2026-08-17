"use client";

import { useState } from "react";
import { useCalendarEntries } from "@/hooks/useCalendarEntries";
import type { CalendarEntry } from "@/types/calendar";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import CalendarMonthView from "./CalendarMonthView";
import CalendarEntryDialog from "./CalendarEntryDialog";

type Props = {
  clientId: number;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

/** Calendário de postagens de um único cliente — vive dentro do drawer de detalhe. */
export default function ClientCalendar({
  clientId,
  canCreate,
  canEdit,
  canDelete,
}: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [dialogDate, setDialogDate] = useState(
    today.toISOString().slice(0, 10),
  );
  const [dialogEntry, setDialogEntry] = useState<CalendarEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CalendarEntry | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const monthStr = `${year}-${String(month).padStart(2, "0")}`;
  // Falha ao listar (ou mês sem nenhuma postagem) são o mesmo estado pra UI:
  // `entries` fica `[]` e o calendário renderiza normal — sem banner de erro.
  const { entries, create, update, remove } = useCalendarEntries(
    clientId,
    monthStr,
  );

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
      {deleteError && <p className="text-sm text-danger">{deleteError}</p>}

      <CalendarMonthView
        year={year}
        month={month}
        entries={entries}
        canCreate={canCreate}
        canEdit={canEdit}
        onCreateDate={openCreateDialog}
        onEditEntry={openEditDialog}
        onChangeMonth={(y, m) => {
          setYear(y);
          setMonth(m);
        }}
      />

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
