"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/client/notificationsApi";
import type { AppNotification } from "@/types/notification";

// Rede de segurança do tempo real: se o WebSocket cair, o contador se corrige sozinho.
const POLL_MS = 60_000;

/** Central de avisos do usuário logado: lista, contador de não lidos e entrega em tempo real. */
export function useNotifications() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const loadedList = useRef(false);

  const refreshCount = useCallback(async () => {
    try {
      setUnread(await fetchUnreadCount());
    } catch {
      // sem rede: mantém o último valor
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchNotifications());
      loadedList.current = true;
    } catch {
      // mantém a lista atual
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let retryMs = 1000;

    const count = async () => {
      if (!cancelled) await refreshCount();
    };

    async function connect() {
      if (cancelled) return;
      try {
        const res = await fetch("/api/notifications/ws-token");
        if (!res.ok || cancelled) return;
        const { token, wsUrl } = await res.json();
        if (cancelled) return;

        socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
        socket.onopen = () => {
          retryMs = 1000;
          count(); // pode ter chegado aviso enquanto estava desconectado
        };
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type !== "notification") return;
            const notification = data.notification as AppNotification;
            setItems((prev) => (prev.some((n) => n.id === notification.id) ? prev : [notification, ...prev]));
            setUnread((n) => n + 1);
          } catch {
            // mensagem fora do formato: ignora
          }
        };
        socket.onclose = scheduleReconnect;
        socket.onerror = () => socket?.close();
      } catch {
        scheduleReconnect();
      }
    }

    function scheduleReconnect() {
      if (cancelled) return;
      reconnectTimer = setTimeout(() => {
        retryMs = Math.min(retryMs * 2, 30_000);
        connect();
      }, retryMs);
    }

    count();
    connect();
    const poll = setInterval(count, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(poll);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) {
        socket.onclose = null;
        socket.onerror = null;
        socket.close();
      }
    };
  }, [refreshCount]);

  const markRead = useCallback(async (id: number) => {
    setItems((prev) => prev.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n)));
    setUnread((n) => Math.max(0, n - 1));
    try {
      await markNotificationRead(id);
    } catch {
      refreshCount();
    }
  }, [refreshCount]);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
    setUnread(0);
    try {
      await markAllNotificationsRead();
    } catch {
      refreshCount();
    }
  }, [refreshCount]);

  return { items, unread, loading, loadList, markRead, markAllRead };
}
