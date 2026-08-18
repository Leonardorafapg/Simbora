"use client";

import { useEffect, useState } from "react";
import { LogOut, MessageCircle } from "lucide-react";
import { disconnect, getChats, getMessages } from "@/services/client/whatsappApi";
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

  async function handleSelectChat(chat: WhatsAppChat) {
    setSelectedChat(chat);
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

        {error && <p className="px-4 py-2 text-xs text-danger">{error}</p>}

        <div className="flex-1 overflow-y-auto">
          <WhatsAppChatList
            chats={chats}
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
