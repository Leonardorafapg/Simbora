"use client";

import { useEffect, useMemo, useState } from "react";
import { LogOut, MessageCircle, Search } from "lucide-react";
import { disconnect, getChats, getMessages } from "@/services/client/whatsappApi";
import { useWhatsAppSocket } from "@/hooks/useWhatsAppSocket";
import type { WhatsAppChat, WhatsAppMessage } from "@/types/whatsapp";
import WhatsAppChatList from "@/components/whatsapp/WhatsAppChatList";
import WhatsAppChatWindow from "@/components/whatsapp/WhatsAppChatWindow";

type Props = {
  onDisconnected: () => void;
};

export default function WhatsAppChatLayout({ onDisconnected }: Props) {
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // remote_jid -> "digitando" | "gravando_audio" | null (limpa o indicador).
  const [typingByJid, setTypingByJid] = useState<Record<string, string | null>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const filteredChats = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return chats;
    return chats.filter((chat) => (chat.name ?? chat.remote_jid).toLowerCase().includes(term));
  }, [chats, searchQuery]);

  useEffect(() => {
    let cancelled = false;

    async function loadChats() {
      setChatsLoading(true);
      try {
        const data = await getChats();
        if (!cancelled) setChats(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Não foi possível carregar as conversas.");
      } finally {
        if (!cancelled) setChatsLoading(false);
      }
    }

    loadChats();
    return () => {
      cancelled = true;
    };
  }, []);

  // Tempo real: mensagem nova chega aqui sem precisar reabrir a conversa nem
  // dar F5 — a lista de conversas e a janela aberta (se for a mesma) atualizam
  // sozinhas. Ver hooks/useWhatsAppSocket.ts.
  useWhatsAppSocket(true, {
    onMessage: (message) => {
      setChats((prev) => {
        const existing = prev.find((c) => c.remote_jid === message.remote_jid);
        const isOpenChat = selectedChat?.remote_jid === message.remote_jid;
        const updated: WhatsAppChat = existing
          ? {
              ...existing,
              last_message: message.text,
              unread_count: isOpenChat || message.from_me ? existing.unread_count : existing.unread_count + 1,
            }
          : {
              remote_jid: message.remote_jid,
              // Em grupo, `sender_name` é quem mandou (participante), não o
              // nome do grupo — sem isso, conversa nova de grupo aparecia com
              // nome de pessoa até o próximo refresh da lista.
              name: message.remote_jid.endsWith("@g.us") ? message.remote_jid : (message.sender_name ?? message.remote_jid),
              is_group: message.remote_jid.endsWith("@g.us"),
              last_message: message.text,
              unread_count: message.from_me ? 0 : 1,
              profile_pic_url: null,
              updated_at: message.timestamp ? String(message.timestamp) : null,
            };
        return [updated, ...prev.filter((c) => c.remote_jid !== message.remote_jid)];
      });

      if (selectedChat?.remote_jid === message.remote_jid) {
        setMessages((prev) => (prev.some((m) => m.id && m.id === message.id) ? prev : [...prev, message]));
      }
    },
    onPresence: (remoteJid, presence) => {
      setTypingByJid((prev) => ({ ...prev, [remoteJid]: presence }));
    },
  });

  async function handleSelectChat(chat: WhatsAppChat) {
    setSelectedChat(chat);
    setChats((prev) => prev.map((c) => (c.remote_jid === chat.remote_jid ? { ...c, unread_count: 0 } : c)));
    setMessagesLoading(true);
    try {
      const data = await getMessages(chat.remote_jid);
      setMessages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as mensagens.");
    } finally {
      setMessagesLoading(false);
    }
  }

  function handleMessageSent(message: WhatsAppMessage) {
    setMessages((prev) => [...prev, message]);
  }

  async function handleDisconnect() {
    try {
      await disconnect();
    } catch {
      // segue pra tela de QR mesmo se o logout falhar — usuário pode tentar reconectar
    } finally {
      onDisconnected();
    }
  }

  return (
    <div className="flex flex-1 min-h-0">
      <div className="w-80 shrink-0 border-r border-white/10 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <p className="text-sm font-semibold text-white">Conversas</p>
          <button
            type="button"
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 text-xs text-white/50 hover:text-danger transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Desconectar
          </button>
        </div>

        <div className="px-3 py-2 border-b border-white/10">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar conversa..."
              className="glass-input w-full rounded-lg pl-8 pr-3 py-1.5 text-sm outline-none"
            />
          </label>
        </div>

        {error && <p className="px-4 py-2 text-xs text-danger">{error}</p>}

        <div className="flex-1 overflow-y-auto">
          <WhatsAppChatList
            chats={filteredChats}
            loading={chatsLoading}
            selectedJid={selectedChat?.remote_jid ?? null}
            onSelect={handleSelectChat}
          />
        </div>
      </div>

      {selectedChat ? (
        <WhatsAppChatWindow
          chat={selectedChat}
          messages={messages}
          loading={messagesLoading}
          typingPresence={typingByJid[selectedChat.remote_jid] ?? null}
          onMessageSent={handleMessageSent}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-white/30 flex-col gap-2">
          <MessageCircle className="h-10 w-10" />
          <p className="text-sm">Selecione uma conversa para começar</p>
        </div>
      )}
    </div>
  );
}
