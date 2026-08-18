import type { WhatsAppChat, WhatsAppMessage, WhatsAppQRCode, WhatsAppStatus } from "@/types/whatsapp";

async function parseErrorMessage(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return data.message ?? fallback;
}

export async function getStatus(): Promise<WhatsAppStatus> {
  const res = await fetch("/api/whatsapp/status");
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível verificar o status do WhatsApp."));
  return res.json();
}

export async function connect(): Promise<WhatsAppQRCode> {
  const res = await fetch("/api/whatsapp/connect", { method: "POST" });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível conectar ao WhatsApp."));
  return res.json();
}

export async function disconnect(): Promise<void> {
  const res = await fetch("/api/whatsapp/disconnect", { method: "POST" });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível desconectar o WhatsApp."));
}

export async function getChats(): Promise<WhatsAppChat[]> {
  const res = await fetch("/api/whatsapp/chats");
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível carregar as conversas."));
  return res.json();
}

export async function getMessages(remoteJid: string): Promise<WhatsAppMessage[]> {
  const res = await fetch(`/api/whatsapp/chats/${encodeURIComponent(remoteJid)}/messages`);
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível carregar as mensagens."));
  return res.json();
}

export async function sendMessage(remoteJid: string, text: string): Promise<WhatsAppMessage> {
  const res = await fetch(`/api/whatsapp/chats/${encodeURIComponent(remoteJid)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível enviar a mensagem."));
  return res.json();
}
