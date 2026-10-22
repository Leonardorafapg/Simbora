"use client";

import { Building2, Users } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { chatTitle, formatChatTime } from "@/lib/whatsapp";
import type { WhatsAppChat } from "@/types/whatsapp";
import WhatsAppLabelChip from "@/components/whatsapp/WhatsAppLabelChip";

type Props = {
  chats: WhatsAppChat[];
  loading: boolean;
  selectedJid: string | null;
  onSelect: (chat: WhatsAppChat) => void;
  /** Há busca ou filtro ativo (muda a mensagem de lista vazia). */
  filtered?: boolean;
};

export default function WhatsAppChatList({ chats, loading, selectedJid, onSelect, filtered }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col gap-1 p-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl p-3">
            <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-surface-2" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/5 animate-pulse rounded bg-surface-2" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-surface-2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-text-faint">
        {filtered ? "Nenhuma conversa com esse filtro." : "Nenhuma conversa ainda."}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-0.5 p-2">
      {chats.map((chat) => {
        const active = chat.remote_jid === selectedJid;
        const unread = chat.unread_count > 0;

        return (
          <li key={chat.remote_jid}>
            <button
              type="button"
              onClick={() => onSelect(chat)}
              aria-current={active ? "true" : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                active ? "bg-accent-soft" : "hover:bg-surface-2"
              }`}
            >
              <div className="relative shrink-0">
                <Avatar name={chatTitle(chat)} photoUrl={chat.profile_pic_url} size="sm" />
                {chat.is_group && (
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-surface">
                    <Users className="h-2.5 w-2.5 text-accent" />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`truncate text-sm ${unread ? "font-semibold text-text" : "font-medium text-text"}`}>
                    {chatTitle(chat)}
                  </p>
                  <span className={`shrink-0 text-[11px] ${unread ? "font-semibold text-accent" : "text-text-faint"}`}>
                    {formatChatTime(chat.updated_at)}
                  </span>
                </div>

                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p className={`truncate text-xs ${unread ? "text-text" : "text-text-muted"}`}>
                    {chat.last_from_me && chat.last_message && <span className="text-text-faint">Você: </span>}
                    {chat.last_message ?? <span className="text-text-faint">Sem mensagens</span>}
                  </p>
                  {unread && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-cyan px-1.5 text-[11px] font-semibold text-black">
                      {chat.unread_count > 99 ? "99+" : chat.unread_count}
                    </span>
                  )}
                </div>

                {(chat.client_name || chat.labels.length > 0) && (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {chat.client_name && (
                      <span
                        className="inline-flex max-w-[10rem] items-center gap-1 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium leading-none text-accent"
                        title={chat.client_linked ? "Cliente vinculado" : "Cliente identificado pelo nome do grupo"}
                      >
                        <Building2 className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{chat.client_name}</span>
                        {!chat.client_linked && <span className="opacity-60">?</span>}
                      </span>
                    )}
                    {chat.labels.slice(0, 2).map((label) => (
                      <WhatsAppLabelChip key={label.id} label={label} />
                    ))}
                    {chat.labels.length > 2 && <span className="text-[10px] text-text-faint">+{chat.labels.length - 2}</span>}
                  </div>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
