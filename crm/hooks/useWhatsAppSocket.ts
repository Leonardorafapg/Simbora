"use client";

import { useEffect, useRef } from "react";
import type { WhatsAppMessage } from "@/types/whatsapp";

type Handlers = {
  onMessage?: (message: WhatsAppMessage) => void;
  onPresence?: (remoteJid: string, presence: string | null) => void;
};

/** Conecta ao WS do WhatsApp só enquanto `enabled` (ex.: conectado ao WhatsApp
 * e com a tela aberta) — evita socket aberto sem necessidade. */
export function useWhatsAppSocket(enabled: boolean, handlers: Handlers) {
  // Ref pra sempre usar os handlers mais recentes sem precisar reconectar o
  // socket a cada re-render do componente que os declara inline.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    let socket: WebSocket | null = null;
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    // Cresce a cada tentativa (1s, 2s, 4s... até 30s) — sem isso, servidor
    // fora do ar por um tempo vira uma tempestade de reconexão a cada troca
    // de aba/rede em vez de uma espera razoável.
    let retryDelayMs = 1000;

    async function connect() {
      if (cancelled) return;
      try {
        const res = await fetch("/api/whatsapp/ws-token");
        if (!res.ok || cancelled) return;
        const { token, wsUrl } = await res.json();
        if (cancelled) return;

        socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
        socket.onopen = () => {
          retryDelayMs = 1000;
        };
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "whatsapp_message") handlersRef.current.onMessage?.(data.message);
            if (data.type === "whatsapp_presence") handlersRef.current.onPresence?.(data.remote_jid, data.presence);
          } catch {
            // mensagem que não é JSON válido (não deveria acontecer) — ignora.
          }
        };
        // Servidor caiu, rede oscilou, deploy reiniciou o backend — sem isso o
        // tempo real morria silenciosamente até o usuário dar F5 na página.
        socket.onclose = scheduleReconnect;
        socket.onerror = () => socket?.close();
      } catch {
        scheduleReconnect();
      }
    }

    function scheduleReconnect() {
      if (cancelled) return;
      reconnectTimer = setTimeout(() => {
        retryDelayMs = Math.min(retryDelayMs * 2, 30_000);
        connect();
      }, retryDelayMs);
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) {
        socket.onclose = null;
        socket.onerror = null;
        socket.close();
      }
    };
  }, [enabled]);
}
