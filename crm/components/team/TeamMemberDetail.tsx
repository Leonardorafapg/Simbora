"use client";

import { useState } from "react";
import type { TeamMember, TeamMemberUpdateInput } from "@/types/team";
import { formatCpf, formatDate } from "@/lib/format";
import Avatar from "@/components/ui/Avatar";
import Field from "@/components/ui/Field";

type Props = {
  member: TeamMember;
  canManage: boolean;
  onBack: () => void;
  onUpdate: (id: number, input: TeamMemberUpdateInput) => Promise<TeamMember>;
  onRequestDelete: (member: TeamMember) => void;
};

export default function TeamMemberDetail({ member, canManage, onBack, onUpdate, onRequestDelete }: Props) {
  // Montado com `key={member.id}` pelo drawer, então o estado inicial já
  // reflete o membro selecionado — sem useEffect de sincronização.
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<TeamMemberUpdateInput>(() => ({
    full_name: member.full_name,
    cpf: member.cpf,
    birth_date: member.birth_date,
    email: member.email,
    cargo: member.cargo,
    is_admin: member.is_admin,
    is_active: member.is_active,
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
      cargo: member.cargo,
      is_admin: member.is_admin,
      is_active: member.is_active,
    });
    setError(null);
    setEditing(false);
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

      <div className="max-w-md space-y-4">
        {editing ? (
          <>
            <Field label="Nome completo">
              <input
                value={form.full_name ?? ""}
                onChange={(e) => update("full_name", e.target.value)}
                className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
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

        {error && <p className="text-sm text-danger">{error}</p>}

        {canManage && (
          <div className="flex items-center gap-3 pt-2">
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
