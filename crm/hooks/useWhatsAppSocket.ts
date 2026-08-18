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

    (async () => {
      try {
        const res = await fetch("/api/whatsapp/ws-token");
        if (!res.ok || cancelled) return;
        const { token, wsUrl } = await res.json();
        if (cancelled) return;

        socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "whatsapp_message") handlersRef.current.onMessage?.(data.message);
            if (data.type === "whatsapp_presence") handlersRef.current.onPresence?.(data.remote_jid, data.presence);
          } catch {
            // mensagem que não é JSON válido (não deveria acontecer) — ignora.
          }
        };
      } catch {
        // Sem WS, o app continua funcional — só perde a atualização em tempo
        // real (usuário ainda vê mensagens ao reabrir/trocar de conversa).
      }
    })();

    return () => {
      cancelled = true;
      socket?.close();
    };
  }, [enabled]);
}
