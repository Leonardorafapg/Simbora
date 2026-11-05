"use client";

import { useEffect, useState } from "react";
import { avatarJidsToFetch, type AvatarCache } from "@/lib/whatsapp";
import { fetchAvatars } from "@/services/client/whatsappApi";
import type { WhatsAppMessage } from "@/types/whatsapp";

// Vale pra aba inteira: trocar de conversa não pede de novo a foto de quem já apareceu.
const cache: AvatarCache = new Map();

/** Fotos de quem manda mensagem num grupo (jid -> link). Fora de grupo não faz nada. */
export function useSenderAvatars(messages: WhatsAppMessage[], isGroup: boolean): Record<string, string | null> {
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (!isGroup) return;
    const jids = avatarJidsToFetch(messages, cache);
    if (jids.length === 0) return;
    let cancelled = false;
    fetchAvatars(jids)
      .then((found) => {
        const now = Date.now();
        for (const jid of jids) cache.set(jid, { url: found[jid] ?? null, at: now });
        if (!cancelled) setVersion((v) => v + 1);
      })
      .catch(() => {
        // sem foto: o balão mostra as iniciais
      });
    return () => {
      cancelled = true;
    };
  }, [messages, isGroup]);

  const result: Record<string, string | null> = {};
  for (const [jid, value] of cache) result[jid] = value.url;
  return result;
}
