"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LogOut, MessageCircle, Search } from "lucide-react";
import { disconnect, getChats, getMessages } from "@/services/client/whatsappApi";
import { useWhatsAppSocket } from "@/hooks/useWhatsAppSocket";
import { previewOf, upsertMessage } from "@/lib/whatsapp";
import type { WhatsAppChat, WhatsAppLabel, WhatsAppMessage } from "@/types/whatsapp";
import WhatsAppChatList from "@/components/whatsapp/WhatsAppChatList";
import WhatsAppChatWindow from "@/components/whatsapp/WhatsAppChatWindow";

type ChatTab = "all" | "unread" | "groups" | "clients";

const TABS: { id: ChatTab; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "unread", label: "Não lidas" },
  { id: "groups", label: "Grupos" },
  { id: "clients", label: "Clientes" },
];

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
  const [tab, setTab] = useState<ChatTab>("all");
  // Só a resposta da conversa aberta por último vale (abrir A e logo B não pode mostrar as de A).
  const openRequest = useRef(0);

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
      if (tab === "unread" && chat.unread_count === 0) return false;
      if (tab === "groups" && !chat.is_group) return false;
      if (tab === "clients" && !chat.client_id) return false;
      if (!term) return true;
      // Busca também por cliente, telefone e etiqueta, não só pelo nome.
      const fields = [chat.name ?? chat.remote_jid, chat.client_name, chat.phone, ...chat.labels.map((l) => l.name)];
      return fields.some((value) => value?.toLowerCase().includes(term));
    });
  }, [chats, searchQuery, labelFilter, tab]);

  const unreadTotal = useMemo(() => chats.filter((c) => c.unread_count > 0).length, [chats]);

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
              last_message: previewOf(message) ?? existing.last_message,
              last_from_me: message.from_me,
              updated_at: message.timestamp ? String(message.timestamp) : existing.updated_at,
              unread_count: isOpenChat || message.from_me ? existing.unread_count : existing.unread_count + 1,
            }
          : {
              remote_jid: message.remote_jid,
              // Em grupo, `sender_name` é quem mandou (participante), não o
              // nome do grupo — sem isso, conversa nova de grupo aparecia com
              // nome de pessoa até o próximo refresh da lista.
              name: message.remote_jid.endsWith("@g.us") ? message.remote_jid : (message.sender_name ?? message.remote_jid),
              is_group: message.remote_jid.endsWith("@g.us"),
              last_message: previewOf(message),
              last_from_me: message.from_me,
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
        setMessages((prev) => upsertMessage(prev, message));
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
    const request = ++openRequest.current;
    setSelectedChat(chat);
    setMessages([]);
    setError(null);
    setChats((prev) => prev.map((c) => (c.remote_jid === chat.remote_jid ? { ...c, unread_count: 0 } : c)));
    setMessagesLoading(true);
    try {
      const data = await getMessages(chat.remote_jid);
      if (request === openRequest.current) setMessages(data);
    } catch (err) {
      if (request === openRequest.current) {
        setError(err instanceof Error ? err.message : "Não foi possível carregar as mensagens.");
      }
    } finally {
      if (request === openRequest.current) setMessagesLoading(false);
    }
  }

  function handleMessageSent(message: WhatsAppMessage) {
    // O WebSocket pode entregar a mesma mensagem antes da resposta do envio — não duplica.
    setMessages((prev) => upsertMessage(prev, message));
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
        className={`w-full md:w-96 shrink-0 border-r border-border bg-surface flex-col min-h-0 ${
          selectedChat ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
          <p className="text-base font-semibold text-text">Conversas</p>
          <button
            type="button"
            onClick={handleDisconnect}
            title="Desconectar o WhatsApp"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-text-muted transition-colors hover:bg-surface-2 hover:text-danger"
          >
            <LogOut className="h-3.5 w-3.5" />
            Desconectar
          </button>
        </div>

        <div className="shrink-0 space-y-2 px-3 pb-2">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar nome, cliente, telefone..."
              className="glass-input w-full rounded-full py-2 pl-9 pr-3 text-sm outline-none"
            />
          </label>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  tab === id ? "bg-cyan text-black" : "bg-surface-2 text-text-muted hover:text-text"
                }`}
              >
                {label}
                {id === "unread" && unreadTotal > 0 && <span className="ml-1 opacity-80">{unreadTotal}</span>}
              </button>
            ))}
          </div>
          {availableLabels.length > 0 && (
            <select
              value={labelFilter}
              onChange={(e) => setLabelFilter(e.target.value)}
              aria-label="Filtrar por etiqueta"
              className="glass-input w-full rounded-lg px-2.5 py-1.5 text-xs outline-none"
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
            filtered={tab !== "all" || labelFilter !== "" || searchQuery.trim() !== ""}
          />
        </div>
      </div>

      {selectedChat ? (
        // min-h-0 em toda a cadeia: sem isso a janela cresce do tamanho do
        // histórico, empurra cabeçalho e campo de mensagem pra fora da tela e
        // a página inteira passa a rolar.
        <div className={`flex-1 min-w-0 min-h-0 flex-col ${selectedChat ? "flex" : "hidden md:flex"}`}>
          <WhatsAppChatWindow
            chat={selectedChat}
            messages={messages}
            loading={messagesLoading}
            typingPresence={typingByJid[selectedChat.remote_jid] ?? null}
            onMessageSent={handleMessageSent}
            onBack={() => setSelectedChat(null)}
          />
        </div>
      ) : (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-3 bg-surface-2/40 text-text-faint">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface ring-1 ring-border">
            <MessageCircle className="h-8 w-8" />
          </span>
          <p className="text-sm">Selecione uma conversa para começar</p>
        </div>
      )}
    </div>
  );
}
