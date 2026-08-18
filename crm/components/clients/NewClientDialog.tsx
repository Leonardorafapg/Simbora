"use client";

import { useState } from "react";
import type { Client, ClientCreateInput } from "@/types/client";
import type { TeamMember } from "@/types/team";
import Field from "@/components/ui/Field";
import UserSelect from "@/components/ui/UserSelect";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (input: ClientCreateInput) => Promise<Client>;
  teamMembers: TeamMember[];
};

const emptyForm: ClientCreateInput = {
  name: "",
  contact_name: "",
  email: "",
  phone: "",
  whatsapp_group_id: "",
  instagram: "",
  notes: "",
  default_social_id: null,
  default_designer_id: null,
};

export default function NewClientDialog({ open, onClose, onCreate, teamMembers }: Props) {
  const [form, setForm] = useState<ClientCreateInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  function update<K extends keyof ClientCreateInput>(key: K, value: ClientCreateInput[K]) {
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
        <h2 className="text-lg font-semibold text-white mb-4">Novo cliente</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Nome do cliente">
            <input
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
            />
          </Field>

          <Field label="Pessoa de contato">
            <input
              value={form.contact_name}
              onChange={(e) => update("contact_name", e.target.value)}
              className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
              />
            </Field>
            <Field label="Telefone">
              <input
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Instagram">
              <input
                placeholder="@usuario"
                value={form.instagram}
                onChange={(e) => update("instagram", e.target.value)}
                className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
              />
            </Field>
            <Field label="Grupo de WhatsApp">
              <input
                value={form.whatsapp_group_id}
                onChange={(e) => update("whatsapp_group_id", e.target.value)}
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
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full min-h-[80px]"
            />
          </Field>

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
