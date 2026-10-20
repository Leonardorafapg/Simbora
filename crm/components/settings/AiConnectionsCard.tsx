"use client";

import { useEffect, useState } from "react";
import { Bot, Unplug } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ConnectClaudeButton from "@/components/settings/ConnectClaudeButton";
import { fetchAiConnections, revokeAiConnection } from "@/services/client/aiConnectionsApi";
import type { AiConnection } from "@/types/aiConnection";

const SCOPE_LABELS: Record<string, string> = {
  "crm.read": "Ler",
  "crm.write": "Criar e editar",
  "crm.delete": "Apagar",
};

// O backend devolve datas em UTC sem fuso ("2026-01-01T12:00:00"): sem o "Z" o browser leria como horário local.
function formatDateTime(value: string | null) {
  if (!value) return "nunca";
  const date = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`);
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function AiConnectionsCard() {
  const [connections, setConnections] = useState<AiConnection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toRevoke, setToRevoke] = useState<AiConnection | null>(null);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchAiConnections();
        if (!cancelled) setConnections(data);
      } catch (err) {
        if (cancelled) return;
        setConnections([]);
        setError(err instanceof Error ? err.message : "Não foi possível carregar as conexões de IA.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function confirmRevoke() {
    if (!toRevoke) return;
    setRevoking(true);
    try {
      await revokeAiConnection(toRevoke.id);
      setConnections((prev) => (prev ?? []).filter((connection) => connection.id !== toRevoke.id));
      setError(null);
      setToRevoke(null);
    } catch (err) {
      setToRevoke(null);
      setError(err instanceof Error ? err.message : "Não foi possível desconectar.");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-cyan/10 flex items-center justify-center text-cyan shrink-0">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Conexões de IA</h2>
          <p className="text-xs text-white/50">
            Apps como Claude, Codex e Gemini que acessam o CRM em seu nome, com as suas permissões.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <ConnectClaudeButton />
      </div>

      <div className="mt-5 flex flex-col gap-2">
        {connections === null ? (
          <p className="text-sm text-white/50">Carregando...</p>
        ) : connections.length === 0 ? (
          <p className="rounded-xl border border-white/10 px-4 py-3 text-sm text-white/50">
            Nenhuma conexão ativa. Clique em &quot;Conectar com o Claude&quot; e siga os passos; o Claude vai abrir a
            tela de login do Simbora.
          </p>
        ) : (
          connections.map((connection) => (
            <div
              key={connection.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-white/10 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-white/90">{connection.client_name}</p>
                <p className="text-xs text-white/50">
                  {connection.scopes.map((scope) => SCOPE_LABELS[scope] ?? scope).join(" · ")}
                </p>
                <p className="text-xs text-white/40">
                  Conectado em {formatDateTime(connection.created_at)} · último uso {formatDateTime(connection.last_used_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setToRevoke(connection)}
                className="flex shrink-0 items-center gap-1.5 text-xs text-white/50 hover:text-danger transition-colors"
              >
                <Unplug className="h-3.5 w-3.5" />
                Desconectar
              </button>
            </div>
          ))
        )}
      </div>

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}

      <ConfirmDialog
        open={toRevoke !== null}
        title="Desconectar este app?"
        description={`${toRevoke?.client_name ?? "O app"} perde o acesso ao CRM agora. Para voltar, será preciso entrar de novo.`}
        confirmLabel="Desconectar"
        loading={revoking}
        onConfirm={confirmRevoke}
        onCancel={() => setToRevoke(null)}
      />
    </div>
  );
}
