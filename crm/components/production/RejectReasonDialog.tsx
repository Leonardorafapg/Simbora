"use client";

import { useState } from "react";

type Props = {
  title: string;
  loading?: boolean;
  /** Falha ao enviar: aparece aqui dentro, porque o diálogo cobre a tela. */
  error?: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
};

/** Pede o motivo antes de mandar o post de volta pra Modificações (obrigatório). */
export default function RejectReasonDialog({ title, loading, error, onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6">
      <div className="glass-modal w-full max-w-md rounded-2xl p-4 sm:p-6">
        <h2 className="text-base font-semibold text-text">Pedir ajustes</h2>
        <p className="mt-1 truncate text-sm text-text-muted">{title}</p>
        <label className="mt-4 block text-xs font-medium text-text-muted" htmlFor="reject-reason">
          O que precisa ser ajustado? O designer recebe este texto.
        </label>
        <textarea
          id="reject-reason"
          autoFocus
          rows={4}
          maxLength={2000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full resize-none rounded-lg border border-border bg-surface-2 p-3 text-sm text-text outline-none focus:border-accent"
        />
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-text">
            Cancelar
          </button>
          <button
            type="button"
            disabled={loading || !trimmed}
            onClick={() => onConfirm(trimmed)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Pedir ajustes"}
          </button>
        </div>
      </div>
    </div>
  );
}
