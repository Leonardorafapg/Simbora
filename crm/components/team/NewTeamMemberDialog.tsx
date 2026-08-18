"use client";

import { useState } from "react";
import type { TeamMember, TeamMemberCreateInput } from "@/types/team";
import Field from "@/components/ui/Field";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (input: TeamMemberCreateInput) => Promise<TeamMember>;
};

const emptyForm: TeamMemberCreateInput = {
  full_name: "",
  cpf: "",
  birth_date: "",
  email: "",
  password: "",
  cargo: "",
  is_admin: false,
};

export default function NewTeamMemberDialog({ open, onClose, onCreate }: Props) {
  const [form, setForm] = useState<TeamMemberCreateInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  function update<K extends keyof TeamMemberCreateInput>(key: K, value: TeamMemberCreateInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleClose() {
    setForm(emptyForm);
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await onCreate(form);
      setForm(emptyForm);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="glass-modal w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-white mb-4">Novo membro</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Nome completo">
            <input
              required
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="CPF">
              <input
                required
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={form.cpf}
                onChange={(e) => update("cpf", e.target.value)}
                className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
              />
            </Field>
            <Field label="Nascimento">
              <input
                required
                type="date"
                value={form.birth_date}
                onChange={(e) => update("birth_date", e.target.value)}
                className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
              />
            </Field>
          </div>

          <Field label="Email">
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
            />
          </Field>

          <Field label="Senha inicial">
            <input
              required
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
            />
          </Field>

          <Field label="Cargo">
            <input
              required
              placeholder="Ex: Gerente de Tráfego, Social Media..."
              value={form.cargo}
              onChange={(e) => update("cargo", e.target.value)}
              className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={form.is_admin}
              onChange={(e) => update("is_admin", e.target.checked)}
            />
            Acesso de administrador
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg px-4 py-2 text-sm text-white/70 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-dark disabled:opacity-60"
            >
              {loading ? "Cadastrando..." : "Cadastrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
