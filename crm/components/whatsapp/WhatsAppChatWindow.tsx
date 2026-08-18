"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { sendMessage } from "@/services/client/whatsappApi";
import type { WhatsAppChat, WhatsAppMessage } from "@/types/whatsapp";

type Props = {
  chat: WhatsAppChat;
  messages: WhatsAppMessage[];
  loading: boolean;
  onMessageSent: (message: WhatsAppMessage) => void;
};

export default function WhatsAppChatWindow({ chat, messages, loading, onMessageSent }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, chat.remote_jid]);

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
    }
  }

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <Avatar name={chat.name ?? chat.remote_jid} photoUrl={chat.profile_pic_url} size="sm" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{chat.name ?? chat.remote_jid}</p>
          {chat.is_group && <p className="text-xs text-white/40">Grupo</p>}
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
          messages.map((message, index) => (
            <div
              key={message.id ?? index}
              className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
                message.from_me ? "self-end bg-cyan/20 text-white" : "self-start bg-white/5 text-white"
              }`}
            >
              {message.text ?? <span className="italic text-white/40">Mensagem sem texto</span>}
            </div>
          ))}

        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-white/10">
        {error && <p className="text-xs text-danger mb-2">{error}</p>}
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
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
