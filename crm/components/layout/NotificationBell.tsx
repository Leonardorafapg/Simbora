"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlarmClock, Bell, CalendarClock, CalendarX, CheckCheck, ClipboardList } from "lucide-react";
import { timeAgo } from "@/lib/agenda";
import { useNotifications } from "@/hooks/useNotifications";
import type { AppNotification } from "@/types/notification";

function NotificationIcon({ type }: { type: string }) {
  if (type === "agenda_cancelada" || type === "agenda_removido") return <CalendarX className="h-4 w-4" />;
  if (type.startsWith("demanda_")) return <ClipboardList className="h-4 w-4" />;
  if (type.startsWith("prazo_")) return <AlarmClock className="h-4 w-4" />;
  return <CalendarClock className="h-4 w-4" />;
}

/** Sino da barra de cima: contador de não lidos e a lista dos últimos avisos. */
export default function NotificationBell() {
  const router = useRouter();
  const { items, unread, loading, loadList, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) loadList();
  }

  function openNotification(notification: AppNotification) {
    if (!notification.read_at) markRead(notification.id);
    setOpen(false);
    if (notification.link) router.push(notification.link);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Avisos (${unread} não lidos)` : "Avisos"}
        aria-expanded={open}
        title="Avisos"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-[#fff]">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="glass-modal fixed inset-x-3 top-16 z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-text">Avisos</p>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unread === 0}
              className="flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text disabled:opacity-40"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todos como lidos
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && items.length === 0 && <p className="p-4 text-sm text-text-muted">Carregando...</p>}
            {!loading && items.length === 0 && <p className="p-6 text-center text-sm text-text-faint">Nenhum aviso por enquanto.</p>}
            <ul>
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openNotification(n)}
                    className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface-2 ${
                      n.read_at ? "" : "bg-accent-soft/50"
                    }`}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-accent">
                      <NotificationIcon type={n.type} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${n.read_at ? "text-text-muted" : "font-semibold text-text"}`}>{n.title}</span>
                      {n.body && <span className="mt-0.5 block text-xs text-text-muted">{n.body}</span>}
                      <span className="mt-1 block text-[11px] text-text-faint">{timeAgo(n.created_at)}</span>
                    </span>
                    {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Não lido" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
