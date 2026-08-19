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

export type WhatsAppChat = {
  remote_jid: string;
  name: string | null;
  is_group: boolean;
  last_message: string | null;
  unread_count: number;
  profile_pic_url: string | null;
  updated_at: string | null;
};

export type WhatsAppMediaType = "image" | "video" | "audio" | "document";

export type WhatsAppMessage = {
  id: string | null;
  remote_jid: string;
  from_me: boolean;
  text: string | null;
  timestamp: number | null;
  sender_name: string | null;
  media_type: WhatsAppMediaType | null;
  media_mimetype: string | null;
};
