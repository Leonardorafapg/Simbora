"use client";

import { Users } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import type { WhatsAppChat } from "@/types/whatsapp";

type Props = {
  chats: WhatsAppChat[];
  loading: boolean;
  selectedJid: string | null;
  onSelect: (chat: WhatsAppChat) => void;
};

export default function WhatsAppChatList({ chats, loading, selectedJid, onSelect }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (chats.length === 0) {
    return <p className="p-4 text-sm text-white/40">Nenhuma conversa encontrada.</p>;
  }

  return (
    <div className="flex flex-col overflow-y-auto">
      {chats.map((chat) => {
        const active = chat.remote_jid === selectedJid;

        return (
          <button
            key={chat.remote_jid}
            type="button"
            onClick={() => onSelect(chat)}
            className={`flex items-center gap-3 px-4 py-3 text-left border-b border-white/5 transition-colors ${
              active ? "bg-cyan/10" : "hover:bg-white/5"
            }`}
          >
            <div className="relative shrink-0">
              <Avatar name={chat.name ?? chat.remote_jid} photoUrl={chat.profile_pic_url} size="sm" />
              {chat.is_group && (
                <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-dark border border-white/10 flex items-center justify-center">
                  <Users className="h-2.5 w-2.5 text-cyan" />
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{chat.name ?? chat.remote_jid}</p>
              {chat.last_message && <p className="text-xs text-white/50 truncate">{chat.last_message}</p>}
            </div>

            {chat.unread_count > 0 && (
              <span className="shrink-0 h-5 min-w-5 px-1.5 rounded-full bg-cyan text-black text-xs font-semibold flex items-center justify-center">
                {chat.unread_count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
