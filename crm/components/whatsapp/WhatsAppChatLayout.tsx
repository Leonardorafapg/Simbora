"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, LogOut, MessageCircle, Search } from "lucide-react";
import { disconnect, getChats, getMessages } from "@/services/client/whatsappApi";
import { useWhatsAppSocket } from "@/hooks/useWhatsAppSocket";
import type { WhatsAppChat, WhatsAppLabel, WhatsAppMessage } from "@/types/whatsapp";
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
  const [labelFilter, setLabelFilter] = useState("");

  // Etiquetas em uso nas conversas — só elas entram no filtro.
  const availableLabels = useMemo(() => {
    const byId = new Map<string, WhatsAppLabel>();
    chats.forEach((chat) => chat.labels.forEach((label) => byId.set(label.id, label)));
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [chats]);

  const filteredChats = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return chats.filter((chat) => {
      if (labelFilter && !chat.labels.some((label) => label.id === labelFilter)) return false;
      if (!term) return true;
      // Busca também por cliente, telefone e etiqueta, não só pelo nome.
      const fields = [chat.name ?? chat.remote_jid, chat.client_name, chat.phone, ...chat.labels.map((l) => l.name)];
      return fields.some((value) => value?.toLowerCase().includes(term));
    });
  }, [chats, searchQuery, labelFilter]);

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
              labels: [],
              phone: null,
              client_id: null,
              client_name: null,
              client_linked: false,
              group_size: null,
              group_description: null,
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
    // Etiqueta mudou no celular — recarrega a lista em silêncio (sem skeleton)
    // e atualiza a conversa aberta com as etiquetas novas.
    onLabelsChanged: async () => {
      try {
        const data = await getChats();
        setChats(data);
        setSelectedChat((current) => (current ? (data.find((c) => c.remote_jid === current.remote_jid) ?? current) : current));
      } catch {
        // mantém a lista atual; o próximo carregamento corrige
      }
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
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* No mobile é lista OU conversa, nunca as duas colunas ao mesmo tempo — no desktop (md+) ambas ficam visíveis lado a lado. */}
      <div
        className={`w-full md:w-80 shrink-0 border-r border-white/10 flex-col min-h-0 ${
          selectedChat ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
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

        <div className="shrink-0 px-3 py-2 border-b border-white/10">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar nome, cliente, telefone..."
              className="glass-input w-full rounded-lg pl-8 pr-3 py-1.5 text-sm outline-none"
            />
          </label>
          {availableLabels.length > 0 && (
            <select
              value={labelFilter}
              onChange={(e) => setLabelFilter(e.target.value)}
              className="glass-input mt-2 w-full rounded-lg px-2.5 py-1.5 text-xs outline-none"
            >
              <option value="">Todas as etiquetas</option>
              {availableLabels.map((label) => (
                <option key={label.id} value={label.id}>
                  {label.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {error && <p className="px-4 py-2 text-xs text-danger">{error}</p>}

        <div className="flex-1 min-h-0 overflow-y-auto">
          <WhatsAppChatList
            chats={filteredChats}
            loading={chatsLoading}
            selectedJid={selectedChat?.remote_jid ?? null}
            onSelect={handleSelectChat}
          />
        </div>
      </div>

      {selectedChat ? (
        // min-h-0 em toda a cadeia: sem isso a janela cresce do tamanho do
        // histórico, empurra cabeçalho e campo de mensagem pra fora da tela e
        // a página inteira passa a rolar.
        <div className={`flex-1 min-w-0 min-h-0 flex-col ${selectedChat ? "flex" : "hidden md:flex"}`}>
          <button
            type="button"
            onClick={() => setSelectedChat(null)}
            className="shrink-0 flex md:hidden items-center gap-1.5 px-4 py-2 text-xs text-white/60 hover:text-white border-b border-white/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Conversas
          </button>
          <WhatsAppChatWindow
            chat={selectedChat}
            messages={messages}
            loading={messagesLoading}
            typingPresence={typingByJid[selectedChat.remote_jid] ?? null}
            onMessageSent={handleMessageSent}
          />
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-white/30 flex-col gap-2">
          <MessageCircle className="h-10 w-10" />
          <p className="text-sm">Selecione uma conversa para começar</p>
        </div>
      )}
    </div>
  );
}
