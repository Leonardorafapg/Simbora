export type WhatsAppStatus = {
  connected: boolean;
  state: string;
};

export type WhatsAppQRCode = {
  connected: boolean;
  base64: string | null;
  code: string | null;
  pairing_code: string | null;
};

export type WhatsAppLabel = {
  id: string;
  name: string;
  /** Índice da paleta do WhatsApp (0-19). */
  color: number;
};

export type WhatsAppChat = {
  remote_jid: string;
  name: string | null;
  is_group: boolean;
  last_message: string | null;
  /** A última mensagem da conversa foi enviada por nós. */
  last_from_me: boolean;
  unread_count: number;
  profile_pic_url: string | null;
  updated_at: string | null;
  labels: WhatsAppLabel[];
  phone: string | null;
  client_id: number | null;
  client_name: string | null;
  /** true = vínculo pelo "Grupo de WhatsApp" do cliente; false = palpite pelo nome do grupo. */
  client_linked: boolean;
  group_size: number | null;
  group_description: string | null;
};

export type WhatsAppMediaType = "image" | "video" | "audio" | "document" | "sticker";

export type WhatsAppMessage = {
  id: string | null;
  remote_jid: string;
  from_me: boolean;
  text: string | null;
  timestamp: number | null;
  sender_name: string | null;
  media_type: WhatsAppMediaType | null;
  media_mimetype: string | null;
  /** Nome original do arquivo (documentos). */
  media_filename?: string | null;
  /** Em grupo: quem mandou (pra mostrar a foto ao lado do balão). */
  sender_jid?: string | null;
  /** Quando é resposta a outra mensagem: id e trecho da citada. */
  reply_to_id?: string | null;
  reply_text?: string | null;
  /** true = a citada é nossa; null = a citada não está no nosso histórico. */
  reply_from_me?: boolean | null;
  reply_author?: string | null;
};
