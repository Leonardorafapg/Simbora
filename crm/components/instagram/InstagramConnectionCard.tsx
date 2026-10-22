"use client";

import { useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { formatBrt } from "@/lib/instagram";
import type { InstagramAccount } from "@/types/instagram";

type Props = {
  account: InstagramAccount | null;
  loading: boolean;
  configured: boolean | null;
  waiting: boolean;
  canManage: boolean;
  onConnect: () => Promise<void>;
  onGetLink: () => Promise<string>;
  onCancelWaiting: () => void;
  onDisconnect: () => Promise<void>;
};

const STATUS_TEXT: Record<string, string> = {
  expirado: "A conexão expirou — reconecte pra voltar a publicar.",
  revogado: "O acesso foi removido pelo dono da conta no Instagram — reconecte.",
  desconectado: "Instagram desconectado.",
  nao_conectado: "Nenhuma conta conectada.",
};

export default function InstagramConnectionCard({
  account,
  loading,
  configured,
  waiting,
  canManage,
  onConnect,
  onGetLink,
  onCancelWaiting,
  onDisconnect,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [copied, setCopied] = useState(false);
  const connected = account?.status === "ativo";

  async function handleConnect() {
    setError(null);
    setBusy(true);
    try {
      await onConnect();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível conectar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyLink() {
    setError(null);
    setBusy(true);
    try {
      const url = await onGetLink();
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível copiar o link.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    setError(null);
    try {
      await onDisconnect();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível desconectar.");
    } finally {
      setBusy(false);
      setConfirmDisconnect(false);
    }
  }

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex flex-wrap items-center gap-3">
        {account?.profile_picture_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL externa (CDN da Meta)
          <img src={account.profile_picture_url} alt="" className="h-11 w-11 rounded-full object-cover" />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-amber-400">
            <Camera className="h-5 w-5 text-text" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {loading ? (
            <p className="text-sm text-text-muted">Carregando...</p>
          ) : connected ? (
            <>
              <p className="text-sm font-semibold text-text">@{account?.username ?? "conta conectada"}</p>
              <p className="text-xs text-text-muted">
                Conectado em {formatBrt(account?.connected_at)} · renovação automática
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-text">Instagram</p>
              <p className={`text-xs ${account && account.status !== "nao_conectado" && account.status !== "desconectado" ? "text-danger" : "text-text-muted"}`}>
                {STATUS_TEXT[account?.status ?? "nao_conectado"]}
              </p>
            </>
          )}
        </div>

        {canManage && !loading && (
          <div className="flex items-center gap-2">
            {connected ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmDisconnect(true)}
                className="rounded-lg px-3 py-2 text-sm text-danger hover:text-danger/70"
              >
                Desconectar
              </button>
            ) : (
              <>
              <button
                type="button"
                disabled={busy || configured === false}
                onClick={handleCopyLink}
                className="rounded-lg border border-border px-3 py-2 text-sm text-text hover:border-cyan/50 disabled:opacity-60"
              >
                {copied ? "Link copiado" : "Copiar link pro cliente"}
              </button>
              <button
                type="button"
                disabled={busy || waiting || configured === false}
                onClick={handleConnect}
                className="rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-dark disabled:opacity-60"
              >
                {account && account.status !== "nao_conectado" ? "Reconectar" : "Conectar Instagram"}
              </button>
              </>
            )}
          </div>
        )}
      </div>

      {waiting && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-text">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Aguardando a autorização no Instagram (quem autoriza é o dono da conta)...
          <button type="button" onClick={onCancelWaiting} className="ml-auto text-text-muted hover:text-text">
            Cancelar
          </button>
        </div>
      )}
      {configured === false && (
        <p className="mt-3 text-xs text-amber-300">
          A integração com o Instagram ainda não foi configurada no servidor (app da Meta). Fale com o administrador.
        </p>
      )}
      {!connected && !loading && canManage && configured !== false && (
        <p className="mt-3 text-xs text-text-faint">
          Precisa ser uma conta profissional (Empresa ou Criador de conteúdo). Se quem tem a senha é o cliente, copie o link e
          mande pra ele (vale 15 minutos) — ele autoriza no celular dele e o CRM nunca vê a senha.
        </p>
      )}
      {error && <p className="mt-3 text-xs text-danger">{error}</p>}

      <ConfirmDialog
        open={confirmDisconnect}
        title="Desconectar Instagram?"
        description="Posts agendados deixam de sair até reconectar. O histórico de posts continua no CRM."
        confirmLabel="Desconectar"
        loading={busy}
        onConfirm={handleDisconnect}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </div>
  );
}
