"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle, Plug, Trash2, X } from "lucide-react";
import { disconnect, getStatus } from "@/services/client/whatsappApi";
import WhatsAppConnectScreen from "@/components/whatsapp/WhatsAppConnectScreen";

export default function WhatsAppConnectionCard() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const status = await getStatus();
      setConnected(status.connected);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  async function handleDisconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      await disconnect();
      setConnected(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível remover a conexão.");
    } finally {
      setDisconnecting(false);
    }
  }

  function handleConnected() {
    setShowConnectModal(false);
    setConnected(true);
  }

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-cyan/10 flex items-center justify-center text-cyan shrink-0">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">WhatsApp</h2>
          <p className="text-xs text-white/50">Conexão usada nas conversas do CRM.</p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              connected === null ? "bg-white/20" : connected ? "bg-emerald-400" : "bg-white/30"
            }`}
          />
          <span className="text-sm text-white/80">
            {connected === null ? "Verificando..." : connected ? "Conectado" : "Nenhuma conexão"}
          </span>
        </div>

        {connected === null ? null : connected ? (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="flex items-center gap-1.5 text-xs text-white/50 hover:text-danger transition-colors disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {disconnecting ? "Removendo..." : "Remover conexão"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowConnectModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-cyan text-black text-xs font-medium px-3 py-1.5 hover:bg-cyan-dark transition-colors"
          >
            <Plug className="h-3.5 w-3.5" />
            Adicionar conexão
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}

      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="relative w-full max-w-sm">
            <button
              type="button"
              onClick={() => setShowConnectModal(false)}
              className="absolute right-2 top-2 z-10 text-white/50 hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
            <WhatsAppConnectScreen onConnected={handleConnected} />
          </div>
        </div>
      )}
    </div>
  );
}
