"use client";

import { Download, FileText } from "lucide-react";
import { formatClock, senderColor } from "@/lib/whatsapp";
import { mediaUrl } from "@/services/client/whatsappApi";
import type { WhatsAppChat, WhatsAppMessage } from "@/types/whatsapp";

const fileExt = (name: string | null | undefined, mime: string | null) =>
  (name?.split(".").pop() || mime?.split("/").pop() || "arquivo").slice(0, 5).toUpperCase();

function Media({ chat, message }: { chat: WhatsAppChat; message: WhatsAppMessage }) {
  if (!message.media_type || !message.id) return null;
  const src = mediaUrl(chat.remote_jid, message.id);
  const download = mediaUrl(chat.remote_jid, message.id, true);

  switch (message.media_type) {
    case "image":
      return (
        <div className="group/media relative overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element -- mídia decodificada sob demanda no backend, sem loader configurado */}
          <img
            src={src}
            alt={message.text || "Imagem"}
            loading="lazy"
            className="max-h-80 w-full cursor-zoom-in object-cover"
            onClick={() => window.open(src, "_blank")}
          />
          <a
            href={download}
            title="Baixar imagem"
            className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-[#fff] opacity-0 backdrop-blur transition-opacity group-hover/media:opacity-100"
          >
            <Download className="h-4 w-4" />
          </a>
        </div>
      );
    case "sticker":
      // eslint-disable-next-line @next/next/no-img-element -- figurinha decodificada sob demanda
      return <img src={src} alt="Figurinha" loading="lazy" className="h-32 w-32 object-contain" />;
    case "video":
      return <video src={src} controls preload="metadata" className="max-h-80 w-full rounded-xl bg-black" />;
    case "audio":
      return <audio src={src} controls preload="none" className="h-10 w-[250px] max-w-full" />;
    case "document": {
      const name = message.media_filename || message.text || "Documento";
      return (
        <a
          href={download}
          title="Baixar documento"
          className="flex items-center gap-3 rounded-xl bg-black/10 p-2.5 transition-colors hover:bg-black/15"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <FileText className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-text">{name}</span>
            <span className="block text-[11px] uppercase text-text-faint">
              {fileExt(message.media_filename, message.media_mimetype)}
            </span>
          </span>
          <Download className="h-4 w-4 shrink-0 text-text-muted" />
        </a>
      );
    }
    default:
      return null;
  }
}

type Props = {
  chat: WhatsAppChat;
  message: WhatsAppMessage;
  /** Primeira do grupo de mensagens seguidas do mesmo remetente (mostra o nome no grupo). */
  first: boolean;
  /** Última do grupo (mostra a "ponta" do balão). */
  last: boolean;
};

export default function WhatsAppMessageBubble({ chat, message, first, last }: Props) {
  const mine = message.from_me;
  const isSticker = message.media_type === "sticker";
  // Legenda: texto da mensagem, exceto em documento (o texto já é o nome do arquivo quando não há filename).
  const caption = message.media_type === "document" && !message.media_filename ? null : message.text;
  const showName = chat.is_group && !mine && first && !!message.sender_name;

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} ${first ? "mt-2" : "mt-0.5"}`}>
      <div
        className={`relative max-w-[78%] text-sm sm:max-w-[68%] ${
          isSticker
            ? ""
            : `px-2.5 py-1.5 shadow-sm ${
                mine
                  ? "bg-accent-soft ring-1 ring-accent/20"
                  : "bg-surface ring-1 ring-border"
              } ${mine ? (last ? "rounded-2xl rounded-br-sm" : "rounded-2xl") : last ? "rounded-2xl rounded-bl-sm" : "rounded-2xl"}`
        }`}
      >
        {showName && (
          <p className="mb-0.5 text-xs font-semibold" style={{ color: senderColor(message.sender_name as string) }}>
            {message.sender_name}
          </p>
        )}

        {message.media_type && (
          <div className={caption ? "mb-1" : ""}>
            <Media chat={chat} message={message} />
          </div>
        )}

        {caption ? (
          <p className="whitespace-pre-wrap break-words text-text">{caption}</p>
        ) : !message.media_type ? (
          <p className="italic text-text-faint">Mensagem sem texto</p>
        ) : null}

        <p className={`mt-0.5 text-right text-[10px] leading-none text-text-faint ${isSticker ? "pr-1" : ""}`}>
          {formatClock(message.timestamp)}
        </p>
      </div>
    </div>
  );
}
