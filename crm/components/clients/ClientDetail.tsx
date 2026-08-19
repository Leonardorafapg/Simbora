"use client";

import { useMemo, useState } from "react";
import type { Client, ClientUpdateInput } from "@/types/client";
import type { TeamMember } from "@/types/team";
import Field from "@/components/ui/Field";
import UserSelect from "@/components/ui/UserSelect";
import Avatar from "@/components/ui/Avatar";
import ImageDropzone from "@/components/ui/ImageDropzone";
import ClientCalendar from "@/components/calendar/ClientCalendar";
import DemandProgressCard from "@/components/demands/DemandProgressCard";
import { useDemands } from "@/hooks/useDemands";
import { MONTH_LABELS } from "@/types/calendar";

type CalendarPermissions = {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

type Props = {
  client: Client;
  canEdit: boolean;
  canDelete: boolean;
  canViewDemands: boolean;
  teamMembers: TeamMember[];
  calendarPermissions: CalendarPermissions;
  onBack: () => void;
  onUpdate: (id: number, input: ClientUpdateInput) => Promise<Client>;
  onRequestDelete: (client: Client) => void;
};

export default function ClientDetail({
  client,
  canEdit,
  canDelete,
  canViewDemands,
  teamMembers,
  calendarPermissions,
  onBack,
  onUpdate,
  onRequestDelete,
}: Props) {
  // Mês/ano do calendário — controlado aqui (não dentro de ClientCalendar)
  // porque "Demandas do cliente" precisa filtrar pelo mesmo período que o
  // calendário está mostrando, não pelo total histórico.
  const today = new Date();
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth() + 1);

  // Montado com `key={client.id}` pelo drawer, então o estado inicial já
  // reflete o cliente selecionado — sem useEffect de sincronização.
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ClientUpdateInput>(() => ({
    name: client.name,
    photo_url: client.photo_url,
    contact_name: client.contact_name ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    whatsapp_group_id: client.whatsapp_group_id ?? "",
    instagram: client.instagram ?? "",
    notes: client.notes ?? "",
    default_social_id: client.default_social_id,
    default_designer_id: client.default_designer_id,
    is_active: client.is_active,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof ClientUpdateInput>(
    key: K,
    value: ClientUpdateInput[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function cancelEdit() {
    setForm({
      name: client.name,
      photo_url: client.photo_url,
      contact_name: client.contact_name ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      whatsapp_group_id: client.whatsapp_group_id ?? "",
      instagram: client.instagram ?? "",
      notes: client.notes ?? "",
      default_social_id: client.default_social_id,
      default_designer_id: client.default_designer_id,
      is_active: client.is_active,
    });
    setError(null);
    setEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onUpdate(client.id, form);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const nameOf = (id: number | null) =>
    teamMembers.find((m) => m.id === id)?.full_name ?? "—";

  // Só as demandas com prazo dentro do mês que o calendário ao lado está
  // mostrando — não o histórico inteiro do cliente. Sem filtro de status:
  // precisamos de todas pra contar concluídas vs. total.
  const monthStart = `${calendarYear}-${String(calendarMonth).padStart(2, "0")}-01`;
  const lastDay = new Date(calendarYear, calendarMonth, 0).getDate();
  const monthEnd = `${calendarYear}-${String(calendarMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { demands } = useDemands(
    useMemo(
      () => ({ client_id: client.id, date_from: monthStart, date_to: monthEnd }),
      [client.id, monthStart, monthEnd],
    ),
  );
  const completedDemands = useMemo(() => demands.filter((d) => d.status === "concluida").length, [demands]);
  const demandsLabel = `Demandas do cliente · ${MONTH_LABELS[calendarMonth - 1]}`;

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-white/60 hover:text-white flex items-center gap-1 mb-6"
      >
        ‹ Voltar
      </button>

      <div className="flex items-center gap-4 mb-8">
        <Avatar name={client.name} photoUrl={client.photo_url} size="lg" />
        <div>
          <p className="text-lg font-semibold text-white">{client.name}</p>
          <p className="text-sm text-cyan">
            {client.contact_name || client.email || "—"}
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-start gap-4">
        <div className="w-full lg:max-w-md space-y-4 shrink-0">
          <div className="glass-card w-full rounded-2xl p-5 space-y-4">
            {editing ? (
              <>
                <Field label="Foto do cliente">
                  <ImageDropzone value={form.photo_url ?? null} onChange={(value) => update("photo_url", value)} />
                </Field>

                <Field label="Nome do cliente">
                  <input
                    value={form.name ?? ""}
                    onChange={(e) => update("name", e.target.value)}
                    className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
                  />
                </Field>

                <Field label="Pessoa de contato">
                  <input
                    value={form.contact_name ?? ""}
                    onChange={(e) => update("contact_name", e.target.value)}
                    className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
                  />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Email">
                    <input
                      type="email"
                      value={form.email ?? ""}
                      onChange={(e) => update("email", e.target.value)}
                      className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
                    />
                  </Field>
                  <Field label="Telefone">
                    <input
                      value={form.phone ?? ""}
                      onChange={(e) => update("phone", e.target.value)}
                      className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Instagram">
                    <input
                      value={form.instagram ?? ""}
                      onChange={(e) => update("instagram", e.target.value)}
                      className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
                    />
                  </Field>
                  <Field label="Grupo de WhatsApp">
                    <input
                      value={form.whatsapp_group_id ?? ""}
                      onChange={(e) =>
                        update("whatsapp_group_id", e.target.value)
                      }
                      className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Social media padrão">
                    <UserSelect
                      options={teamMembers}
                      value={form.default_social_id}
                      onChange={(value) => update("default_social_id", value)}
                    />
                  </Field>
                  <Field label="Designer padrão">
                    <UserSelect
                      options={teamMembers}
                      value={form.default_designer_id}
                      onChange={(value) => update("default_designer_id", value)}
                    />
                  </Field>
                </div>

                <Field label="Observações">
                  <textarea
                    value={form.notes ?? ""}
                    onChange={(e) => update("notes", e.target.value)}
                    className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full min-h-[80px]"
                  />
                </Field>

                <label className="flex items-center gap-2 text-sm text-white/70">
                  <input
                    type="checkbox"
                    checked={form.is_active ?? true}
                    onChange={(e) => update("is_active", e.target.checked)}
                  />
                  Ativo
                </label>
              </>
            ) : (
              <>
                <InfoRow label="Email" value={client.email || "—"} />
                <InfoRow label="Telefone" value={client.phone || "—"} />
                <InfoRow label="Instagram" value={client.instagram || "—"} />
                <InfoRow
                  label="Grupo de WhatsApp"
                  value={client.whatsapp_group_id || "—"}
                />
                <InfoRow
                  label="Social media padrão"
                  value={nameOf(client.default_social_id)}
                />
                <InfoRow
                  label="Designer padrão"
                  value={nameOf(client.default_designer_id)}
                />
                <InfoRow label="Observações" value={client.notes || "—"} />
                <InfoRow
                  label="Status"
                  value={client.is_active ? "Ativo" : "Inativo"}
                />
              </>
            )}
          </div>

          {canViewDemands && (
            <DemandProgressCard label={demandsLabel} total={demands.length} completed={completedDemands} />
          )}

          {error && <p className="text-sm text-danger max-w-md">{error}</p>}

          {(canEdit || canDelete) && (
            <div className="flex items-center gap-3 pt-2 max-w-md">
              {canEdit && editing ? (
                <>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSave}
                    className="rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-dark disabled:opacity-60"
                  >
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="rounded-lg px-4 py-2 text-sm text-white/70 hover:text-white"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                canEdit && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:border-cyan/50"
                  >
                    Editar
                  </button>
                )
              )}

              {canDelete && (
                <button
                  type="button"
                  onClick={() => onRequestDelete(client)}
                  className="ml-auto rounded-lg px-4 py-2 text-sm text-danger hover:text-danger/70"
                >
                  Remover cliente
                </button>
              )}
            </div>
          )}
        </div>

        <div className="w-full min-w-0">
          <ClientCalendar
            clientId={client.id}
            clientName={client.name}
            canCreate={calendarPermissions.canCreate}
            canEdit={calendarPermissions.canEdit}
            canDelete={calendarPermissions.canDelete}
            year={calendarYear}
            month={calendarMonth}
            onChangeMonth={(y, m) => {
              setCalendarYear(y);
              setCalendarMonth(m);
            }}
          />
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-white/40">{label}</p>
      <p className="text-sm text-white">{value}</p>
    </div>
  );
}
