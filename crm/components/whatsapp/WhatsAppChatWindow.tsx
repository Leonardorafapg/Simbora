"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, Send } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { mediaUrl, sendMessage, sendTyping } from "@/services/client/whatsappApi";
import type { WhatsAppChat, WhatsAppMessage } from "@/types/whatsapp";

function MessageMedia({ chat, message }: { chat: WhatsAppChat; message: WhatsAppMessage }) {
  if (!message.media_type || !message.id) return null;
  const src = mediaUrl(chat.remote_jid, message.id);

  switch (message.media_type) {
    case "image":
      return (
        <div className="relative group">
          {/* eslint-disable-next-line @next/next/no-img-element -- mídia decodificada sob demanda no backend, sem loader configurado */}
          <img
            src={src}
            alt={message.text || "Imagem"}
            className="max-w-full max-h-72 rounded-lg object-cover cursor-pointer"
            onClick={() => window.open(src, "_blank")}
          />
          <a
            href={mediaUrl(chat.remote_jid, message.id, true)}
            className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title="Baixar imagem"
          >
            <Download className="h-3.5 w-3.5 text-white" />
          </a>
        </div>
      );
    case "video":
      return (
        <div className="relative group">
          <video src={src} controls className="max-w-full max-h-72 rounded-lg" />
          <a
            href={mediaUrl(chat.remote_jid, message.id, true)}
            className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title="Baixar vídeo"
          >
            <Download className="h-3.5 w-3.5 text-white" />
          </a>
        </div>
      );
    case "audio":
      return <audio src={src} controls className="max-w-[240px]" />;
    case "document":
      return (
        <a
          href={mediaUrl(chat.remote_jid, message.id, true)}
          className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 hover:bg-black/30 transition-colors"
        >
          <FileText className="h-5 w-5 shrink-0 text-cyan" />
          <span className="text-sm truncate flex-1">{message.text || "Documento"}</span>
          <Download className="h-4 w-4 shrink-0 text-white/50" />
        </a>
      );
    default:
      return null;
  }
}

const TYPING_PRESENCE_LABELS: Record<string, string> = {
  digitando: "digitando...",
  gravando_audio: "gravando áudio...",
};

// Não manda um evento por tecla — só no máximo 1 a cada 3s enquanto a pessoa
// continua digitando (a Evolution já expira o indicador sozinha do lado do
// contato depois de alguns segundos, então reforçar é o suficiente).
const TYPING_THROTTLE_MS = 3000;

/** "Hoje" / "Ontem" / "23 de agosto de 2026" — mesmo critério do WhatsApp. */
function formatDayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Hoje";
  if (sameDay(date, yesterday)) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

type MessageRow = { type: "message"; message: WhatsAppMessage } | { type: "day"; label: string };

/** Insere um separador de dia antes do primeiro item de cada data — as
 * mensagens já chegam em ordem cronológica (ver evolution_client.find_messages). */
function groupByDay(messages: WhatsAppMessage[]): MessageRow[] {
  const rows: MessageRow[] = [];
  let lastLabel: string | null = null;

  for (const message of messages) {
    const label = message.timestamp ? formatDayLabel(new Date(message.timestamp * 1000)) : null;
    if (label && label !== lastLabel) {
      rows.push({ type: "day", label });
      lastLabel = label;
    }
    rows.push({ type: "message", message });
  }

  return rows;
}

type Props = {
  chat: WhatsAppChat;
  messages: WhatsAppMessage[];
  loading: boolean;
  /** "digitando" | "gravando_audio" | null — vem do webhook via WebSocket. */
  typingPresence?: string | null;
  onMessageSent: (message: WhatsAppMessage) => void;
};

export default function WhatsAppChatWindow({ chat, messages, loading, typingPresence, onMessageSent }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastTypingSentAt = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, chat.remote_jid]);

  function handleTextChange(value: string) {
    setText(value);
    const now = Date.now();
    if (value.trim() && now - lastTypingSentAt.current > TYPING_THROTTLE_MS) {
      lastTypingSentAt.current = now;
      sendTyping(chat.remote_jid, "composing");
    }
  }

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);

    try {
      const message = await sendMessage(chat.remote_jid, trimmed);
      onMessageSent(message);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
      // Clicar no ícone de enviar tira o foco da caixa de texto — devolve pra
      // continuar digitando a próxima mensagem sem precisar clicar de novo.
      inputRef.current?.focus();
    }
  }

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <Avatar name={chat.name ?? chat.remote_jid} photoUrl={chat.profile_pic_url} size="sm" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{chat.name ?? chat.remote_jid}</p>
          {typingPresence && TYPING_PRESENCE_LABELS[typingPresence] ? (
            <p className="text-xs text-cyan">{TYPING_PRESENCE_LABELS[typingPresence]}</p>
          ) : (
            chat.is_group && <p className="text-xs text-white/40">Grupo</p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {loading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`h-10 rounded-2xl bg-white/5 animate-pulse ${i % 2 === 0 ? "w-2/3 self-start" : "w-1/2 self-end"}`}
              />
            ))}
          </div>
        )}

        {!loading && messages.length === 0 && (
          <p className="text-sm text-white/40 text-center mt-8">Nenhuma mensagem ainda.</p>
        )}

        {!loading &&
          groupByDay(messages).map((row, index) =>
            row.type === "day" ? (
              <div key={`day-${index}`} className="self-center my-2 px-3 py-1 rounded-full bg-white/5 text-xs text-white/50">
                {row.label}
              </div>
            ) : (
              <div
                key={row.message.id ?? index}
                className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
                  row.message.from_me ? "self-end bg-cyan/20 text-white" : "self-start bg-white/5 text-white"
                }`}
              >
                {chat.is_group && !row.message.from_me && row.message.sender_name && (
                  <p className="text-xs font-medium text-cyan mb-0.5">{row.message.sender_name}</p>
                )}

                {row.message.media_type && (
                  <div className="mb-1">
                    <MessageMedia chat={chat} message={row.message} />
                  </div>
                )}

                {row.message.media_type === "image" || row.message.media_type === "video" ? (
                  row.message.text && <p className="mt-1">{row.message.text}</p>
                ) : row.message.media_type === "document" ? null : (
                  row.message.text ?? <span className="italic text-white/40">Mensagem sem texto</span>
                )}
              </div>
            ),
          )}

        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-white/10">
        {error && <p className="text-xs text-danger mb-2">{error}</p>}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Digite uma mensagem..."
            className="glass-input rounded-lg px-3 py-2 text-sm outline-none flex-1"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !text.trim()}
            className="h-9 w-9 shrink-0 rounded-lg bg-cyan text-black flex items-center justify-center hover:bg-cyan-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
