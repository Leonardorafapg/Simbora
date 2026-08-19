"use client";

import { useMemo, useState } from "react";
import type { TeamMember, TeamMemberUpdateInput } from "@/types/team";
import { formatCpf, formatDate } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import Avatar from "@/components/ui/Avatar";
import Field from "@/components/ui/Field";
import Switch from "@/components/ui/Switch";
import ImageDropzone from "@/components/ui/ImageDropzone";
import DemandProgressCard from "@/components/demands/DemandProgressCard";
import { useDemands } from "@/hooks/useDemands";

type Props = {
  member: TeamMember;
  canManage: boolean;
  canViewDemands: boolean;
  onBack: () => void;
  onUpdate: (id: number, input: TeamMemberUpdateInput) => Promise<TeamMember>;
  onRequestDelete: (member: TeamMember) => void;
};

export default function TeamMemberDetail({
  member,
  canManage,
  canViewDemands,
  onBack,
  onUpdate,
  onRequestDelete,
}: Props) {
  // Sem filtro de status: precisamos de todas pra contar concluídas vs. total.
  const { demands } = useDemands(useMemo(() => ({ assignee_id: member.id }), [member.id]));
  const completedDemands = useMemo(() => demands.filter((d) => d.status === "concluida").length, [demands]);
  // Montado com `key={member.id}` pelo drawer, então o estado inicial já
  // reflete o membro selecionado — sem useEffect de sincronização.
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<TeamMemberUpdateInput>(() => ({
    full_name: member.full_name,
    cpf: member.cpf,
    birth_date: member.birth_date,
    email: member.email,
    photo_url: member.photo_url,
    cargo: member.cargo,
    is_admin: member.is_admin,
    is_active: member.is_active,
    permissions: member.permissions,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof TeamMemberUpdateInput>(key: K, value: TeamMemberUpdateInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function cancelEdit() {
    setForm({
      full_name: member.full_name,
      cpf: member.cpf,
      birth_date: member.birth_date,
      email: member.email,
      photo_url: member.photo_url,
      cargo: member.cargo,
      is_admin: member.is_admin,
      is_active: member.is_active,
      permissions: member.permissions,
    });
    setError(null);
    setEditing(false);
  }

  function togglePermission(key: string, checked: boolean) {
    setForm((prev) => {
      const current = prev.permissions ?? [];
      return {
        ...prev,
        permissions: checked ? [...current, key] : current.filter((k) => k !== key),
      };
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onUpdate(member.id, form);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

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
        <Avatar name={member.full_name} photoUrl={member.photo_url} size="lg" />
        <div>
          <p className="text-lg font-semibold text-white">{member.full_name}</p>
          <p className="text-sm text-cyan">{member.cargo}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className={editing ? "flex flex-col lg:flex-row items-start gap-4" : "max-w-md"}>
          <div className="glass-card w-full max-w-md rounded-2xl p-5 space-y-4">
            {editing ? (
              <>
                <Field label="Foto de perfil">
                  <ImageDropzone value={form.photo_url ?? null} onChange={(value) => update("photo_url", value)} />
                </Field>

                <Field label="Nome completo">
                  <input
                    value={form.full_name ?? ""}
                    onChange={(e) => update("full_name", e.target.value)}
                    className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
                  />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="CPF">
                    <input
                      value={form.cpf ?? ""}
                      onChange={(e) => update("cpf", e.target.value)}
                      className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
                    />
                  </Field>
                  <Field label="Nascimento">
                    <input
                      type="date"
                      value={form.birth_date ?? ""}
                      onChange={(e) => update("birth_date", e.target.value)}
                      className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
                    />
                  </Field>
                </div>

                <Field label="Email">
                  <input
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) => update("email", e.target.value)}
                    className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
                  />
                </Field>

                <Field label="Cargo">
                  <input
                    value={form.cargo ?? ""}
                    onChange={(e) => update("cargo", e.target.value)}
                    className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
                  />
                </Field>

                <label className="flex items-center gap-2 text-sm text-white/70">
                  <input
                    type="checkbox"
                    checked={form.is_admin ?? false}
                    onChange={(e) => update("is_admin", e.target.checked)}
                  />
                  Acesso de administrador
                </label>

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
                <InfoRow label="CPF" value={formatCpf(member.cpf)} />
                <InfoRow label="Data de nascimento" value={formatDate(member.birth_date)} />
                <InfoRow label="Email" value={member.email} />
                <InfoRow label="Administrador" value={member.is_admin ? "Sim" : "Não"} />
                <InfoRow label="Status" value={member.is_active ? "Ativo" : "Inativo"} />
              </>
            )}
          </div>

          {editing && (
            <div className="glass-card w-full max-w-xs rounded-2xl p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-white">Permissões</p>
                <p className="text-xs text-white/40 mt-1">
                  {form.is_admin
                    ? "Administrador tem acesso total — as permissões abaixo não se aplicam."
                    : "Conceda acesso pontual a cada recurso."}
                </p>
              </div>

              <div className="space-y-3">
                {PERMISSIONS.map((permission) => (
                  <div key={permission.key} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white/70">{permission.label}</span>
                    <Switch
                      checked={!!form.is_admin || (form.permissions ?? []).includes(permission.key)}
                      disabled={!!form.is_admin}
                      onChange={(checked) => togglePermission(permission.key, checked)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {canViewDemands && (
          <div className="max-w-md">
            <DemandProgressCard label="Demandas do responsável" total={demands.length} completed={completedDemands} />
          </div>
        )}

        {error && <p className="text-sm text-danger max-w-md">{error}</p>}

        {canManage && (
          <div className="flex items-center gap-3 pt-2 max-w-md">
            {editing ? (
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
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:border-cyan/50"
              >
                Editar
              </button>
            )}

            <button
              type="button"
              onClick={() => onRequestDelete(member)}
              className="ml-auto rounded-lg px-4 py-2 text-sm text-danger hover:text-danger/70"
            >
              Remover da equipe
            </button>
          </div>
        )}
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
