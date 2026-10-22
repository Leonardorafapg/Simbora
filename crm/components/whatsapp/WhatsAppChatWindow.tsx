"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, Building2, Paperclip, Users } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import WhatsAppLabelChip from "@/components/whatsapp/WhatsAppLabelChip";
import WhatsAppMessageBubble from "@/components/whatsapp/WhatsAppMessageBubble";
import WhatsAppComposer from "@/components/whatsapp/WhatsAppComposer";
import { buildRows } from "@/lib/whatsapp";
import type { WhatsAppChat, WhatsAppMessage } from "@/types/whatsapp";

const TYPING_PRESENCE_LABELS: Record<string, string> = {
  digitando: "digitando...",
  gravando_audio: "gravando áudio...",
};

// Distância do fim a partir da qual a conversa não "gruda" mais no fim ao chegar mensagem nova.
const STICK_TO_BOTTOM_PX = 140;

type Props = {
  chat: WhatsAppChat;
  messages: WhatsAppMessage[];
  loading: boolean;
  /** "digitando" | "gravando_audio" | null — vem do webhook via WebSocket. */
  typingPresence?: string | null;
  onMessageSent: (message: WhatsAppMessage) => void;
  /** Volta pra lista (só aparece no mobile). */
  onBack: () => void;
};

export default function WhatsAppChatWindow({ chat, messages, loading, typingPresence, onMessageSent, onBack }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const dragDepth = useRef(0);
  const [showJump, setShowJump] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);

  const rows = useMemo(() => buildRows(messages), [messages]);

  // Conversa nova abre no fim; mensagem nova só puxa pro fim se a pessoa já estava lá embaixo
  // (ou se a mensagem é dela) — senão atrapalha quem está lendo o histórico.
  useEffect(() => {
    stickToBottom.current = true;
  }, [chat.remote_jid]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const last = messages[messages.length - 1];
    if (stickToBottom.current || last?.from_me) el.scrollTo({ top: el.scrollHeight });
  }, [messages, chat.remote_jid, loading]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottom.current = distance < STICK_TO_BOTTOM_PX;
    setShowJump(distance > 400);
  }

  const subtitle = [
    chat.is_group ? (chat.group_size ? `Grupo · ${chat.group_size} participantes` : "Grupo") : chat.phone,
    chat.client_name && `Cliente: ${chat.client_name}${chat.client_linked ? "" : " (pelo nome)"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="relative flex min-h-0 min-w-0 flex-1 flex-col"
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) setDroppedFile(file);
      }}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar para as conversas"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-text md:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="relative shrink-0">
          <Avatar name={chat.name ?? chat.remote_jid} photoUrl={chat.profile_pic_url} size="sm" />
          {chat.is_group && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-surface">
              <Users className="h-2.5 w-2.5 text-accent" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text">{chat.name ?? chat.remote_jid}</p>
          {typingPresence && TYPING_PRESENCE_LABELS[typingPresence] ? (
            <p className="text-xs text-accent">{TYPING_PRESENCE_LABELS[typingPresence]}</p>
          ) : (
            <p className="flex items-center gap-1 truncate text-xs text-text-faint" title={chat.group_description ?? undefined}>
              {chat.client_name && <Building2 className="h-3 w-3 shrink-0" />}
              <span className="truncate">{subtitle}</span>
            </p>
          )}
        </div>
        {chat.labels.length > 0 && (
          <div className="hidden max-w-[45%] shrink-0 flex-wrap justify-end gap-1 lg:flex">
            {chat.labels.map((label) => (
              <WhatsAppLabelChip key={label.id} label={label} />
            ))}
          </div>
        )}
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto bg-surface-2/40 px-3 py-4 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:20px_20px] sm:px-6"
        >
          {loading && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-10 animate-pulse rounded-2xl bg-surface ${i % 2 === 0 ? "w-2/3 self-start" : "w-1/2 self-end"}`}
                />
              ))}
            </div>
          )}

          {!loading && messages.length === 0 && (
            <p className="mt-10 text-center text-sm text-text-faint">Nenhuma mensagem ainda. Envie a primeira!</p>
          )}

          {!loading &&
            rows.map((row) =>
              row.type === "day" ? (
                <div key={row.key} className="sticky top-0 z-10 my-3 flex justify-center">
                  <span className="rounded-full bg-surface px-3 py-1 text-[11px] font-medium text-text-muted shadow-sm ring-1 ring-border">
                    {row.label}
                  </span>
                </div>
              ) : (
                <WhatsAppMessageBubble key={row.key} chat={chat} message={row.message} first={row.first} last={row.last} />
              ),
            )}
        </div>

        {showJump && (
          <button
            type="button"
            onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })}
            aria-label="Ir para a última mensagem"
            className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-text-muted shadow-md ring-1 ring-border transition-colors hover:text-text"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        )}
      </div>

      <WhatsAppComposer
        remoteJid={chat.remote_jid}
        onSent={onMessageSent}
        droppedFile={droppedFile}
        onDroppedFileHandled={() => setDroppedFile(null)}
      />

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-accent bg-surface/85 text-accent backdrop-blur-sm">
          <Paperclip className="h-8 w-8" />
          <p className="text-sm font-medium">Solte para anexar</p>
        </div>
      )}
    </div>
  );
}
