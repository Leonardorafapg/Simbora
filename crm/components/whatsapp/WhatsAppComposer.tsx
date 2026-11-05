"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Paperclip, Send, Smile, X } from "lucide-react";
import EmojiPicker from "@/components/whatsapp/EmojiPicker";
import { formatFileSize } from "@/lib/whatsapp";
import { insertAtCursor, type ReplyTarget } from "@/lib/whatsappReply";
import { sendMedia, sendMessage, sendTyping } from "@/services/client/whatsappApi";
import type { WhatsAppMessage } from "@/types/whatsapp";

// Mesmo limite do backend (routers/whatsapp.py).
const MAX_FILE_BYTES = 25 * 1024 * 1024;
// No máximo 1 evento "digitando" a cada 3s (a Evolution expira o indicador sozinha).
const TYPING_THROTTLE_MS = 3000;

type Props = {
  remoteJid: string;
  disabled?: boolean;
  onSent: (message: WhatsAppMessage) => void;
  /** Arquivo solto na conversa (drag & drop feito pela janela). */
  droppedFile?: File | null;
  onDroppedFileHandled?: () => void;
  /** Mensagem que está sendo respondida (mostrada numa barra acima do campo). */
  replyTo?: ReplyTarget | null;
  onCancelReply?: () => void;
};

export default function WhatsAppComposer({
  remoteJid,
  disabled,
  onSent,
  droppedFile,
  onDroppedFileHandled,
  replyTo,
  onCancelReply,
}: Props) {
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTypingSentAt = useRef(0);

  // Troca de conversa: cada uma começa limpa (rascunho e anexo não vazam entre conversas).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setText("");
      setFile(null);
      setError(null);
      setEmojiOpen(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [remoteJid]);

  // Escolheu uma mensagem pra responder: o cursor volta pro campo.
  useEffect(() => {
    if (replyTo) areaRef.current?.focus();
  }, [replyTo]);

  // Seletor de emojis: fecha ao clicar fora ou com Esc.
  useEffect(() => {
    if (!emojiOpen) return;
    const onDown = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setEmojiOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEmojiOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [emojiOpen]);

  useEffect(() => {
    if (!droppedFile) return;
    const timer = window.setTimeout(() => {
      pickFile(droppedFile);
      onDroppedFileHandled?.();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a um novo arquivo solto
  }, [droppedFile]);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      const timer = window.setTimeout(() => setPreviewUrl(null), 0);
      return () => window.clearTimeout(timer);
    }
    const url = URL.createObjectURL(file);
    const timer = window.setTimeout(() => setPreviewUrl(url), 0);
    return () => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Cresce com o texto até ~6 linhas.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [text]);

  function pickFile(next: File | null | undefined) {
    if (!next) return;
    if (next.size > MAX_FILE_BYTES) {
      setError(`"${next.name}" passa de ${formatFileSize(MAX_FILE_BYTES)}.`);
      return;
    }
    setError(null);
    setFile(next);
    areaRef.current?.focus();
  }

  function handleTextChange(value: string) {
    setText(value);
    const now = Date.now();
    if (value.trim() && now - lastTypingSentAt.current > TYPING_THROTTLE_MS) {
      lastTypingSentAt.current = now;
      sendTyping(remoteJid, "composing");
    }
  }

  const canSend = !sending && !disabled && (file !== null || text.trim().length > 0);

  // Emoji entra no cursor (ou no lugar do texto selecionado), como no WhatsApp Web.
  function insertEmoji(emoji: string) {
    const el = areaRef.current;
    const result = insertAtCursor(text, el?.selectionStart ?? text.length, el?.selectionEnd ?? text.length, emoji);
    setText(result.text);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(result.cursor, result.cursor);
    });
  }

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const message = file
        ? await sendMedia(remoteJid, file, text, replyTo?.id)
        : await sendMessage(remoteJid, text.trim(), replyTo?.id);
      onSent(message);
      onCancelReply?.();
      setText("");
      setFile(null);
      setEmojiOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar.");
    } finally {
      setSending(false);
      // O clique no botão tira o foco da caixa — devolve pra continuar digitando.
      areaRef.current?.focus();
    }
  }

  return (
    <div className="shrink-0 border-t border-border bg-surface px-3 py-2.5">
      {file && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-2">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- pré-visualização local (blob:)
            <img src={previewUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <FileText className="h-6 w-6" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text">{file.name}</p>
            <p className="text-xs text-text-faint">{formatFileSize(file.size)} · a legenda é o texto abaixo</p>
          </div>
          <button
            type="button"
            onClick={() => setFile(null)}
            disabled={sending}
            aria-label="Remover anexo"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface hover:text-danger"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {replyTo && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-2 pl-3">
          <div className="min-w-0 flex-1 border-l-4 border-accent pl-2.5">
            <p className="truncate text-xs font-semibold text-accent">Respondendo a {replyTo.author === "Você" ? "você" : replyTo.author}</p>
            <p className="line-clamp-2 break-words text-xs text-text-muted">{replyTo.text}</p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancelar resposta"
            title="Cancelar resposta"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface hover:text-danger"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && <p className="mb-2 px-1 text-xs text-danger">{error}</p>}

      <div className="flex items-end gap-2">
        <div ref={emojiRef} className="relative shrink-0">
          {emojiOpen && <EmojiPicker onPick={insertEmoji} />}
          <button
            type="button"
            onClick={() => setEmojiOpen((open) => !open)}
            disabled={sending || disabled}
            title="Emojis"
            aria-label="Emojis"
            aria-expanded={emojiOpen}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-50 ${
              emojiOpen ? "bg-surface-2 text-accent" : "text-text-muted"
            }`}
          >
            <Smile className="h-5 w-5" />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            pickFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending || disabled}
          title="Anexar arquivo"
          aria-label="Anexar arquivo"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-50"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        <textarea
          ref={areaRef}
          value={text}
          rows={1}
          disabled={disabled}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={(e) => {
            // Enter envia, Shift+Enter quebra a linha; não envia no meio da composição (IME/acentos).
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              handleSend();
            }
            // Esc cancela a resposta (o seletor de emojis fecha pelo próprio Esc, em outro ouvinte).
            if (e.key === "Escape" && replyTo && !emojiOpen) onCancelReply?.();
          }}
          onPaste={(e) => {
            const pasted = Array.from(e.clipboardData.files)[0];
            if (pasted) {
              e.preventDefault();
              pickFile(pasted);
            }
          }}
          placeholder={file ? "Adicione uma legenda..." : "Digite uma mensagem"}
          className="glass-input max-h-36 min-h-10 flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm leading-5 outline-none"
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          title="Enviar"
          aria-label="Enviar"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan text-black transition hover:bg-cyan-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
