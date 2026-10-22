"use client";

import { useState } from "react";
import { changeTeamMemberPassword } from "@/services/client/teamApi";
import Field from "@/components/ui/Field";

type Props = {
  memberId: number;
  memberName: string;
};

/**
 * Troca de senha de um membro — só aparece para quem gerencia a equipe
 * (admin). A senha nova nunca volta do servidor nem fica na tela depois de
 * salva.
 */
export default function ChangePasswordForm({ memberId, memberName }: Props) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function close() {
    setOpen(false);
    setPassword("");
    setConfirm("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }

    setSaving(true);
    try {
      await changeTeamMemberPassword(memberId, password);
      close();
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alterar a senha.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setOpen(true);
          }}
          className="rounded-lg border border-border px-4 py-2 text-sm text-text hover:border-cyan/50"
        >
          Alterar senha
        </button>
        {done && <p className="text-sm text-cyan">Senha alterada.</p>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card w-full max-w-md rounded-2xl p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-text">Alterar senha</p>
        <p className="text-xs text-text-faint mt-1">
          Nova senha de acesso de {memberName}. Quem estiver logado continua com a sessão atual até ela expirar.
        </p>
      </div>

      <Field label="Nova senha">
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={4}
          maxLength={72}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
        />
      </Field>

      <Field label="Confirmar nova senha">
        <input
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
        />
      </Field>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-dark disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar senha"}
        </button>
        <button type="button" onClick={close} className="rounded-lg px-4 py-2 text-sm text-text hover:text-text">
          Cancelar
        </button>
      </div>
    </form>
  );
}
