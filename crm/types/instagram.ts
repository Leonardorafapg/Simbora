export type InstagramMediaType = "IMAGE" | "CAROUSEL" | "REELS" | "STORIES";

export const INSTAGRAM_MEDIA_TYPE_LABELS: Record<InstagramMediaType, string> = {
  IMAGE: "Feed (imagem)",
  CAROUSEL: "Carrossel",
  REELS: "Reels",
  STORIES: "Story",
};

export type InstagramAccountStatus = "nao_conectado" | "ativo" | "expirado" | "revogado" | "desconectado";

export type InstagramAccount = {
  client_id: number;
  status: InstagramAccountStatus;
  username: string | null;
  profile_picture_url: string | null;
  token_expires_at: string | null;
  connected_at: string | null;
  last_error: string | null;
};

export type InstagramProfile = {
  username: string | null;
  name: string | null;
  biography: string | null;
  followers_count: number | null;
  media_count: number | null;
  profile_picture_url: string | null;
};

export type InstagramPostStatus = "pendente" | "publicando" | "publicado" | "erro";

export type InstagramPost = {
  id: number;
  client_id: number;
  calendar_entry_id: number | null;
  media_type: InstagramMediaType;
  media_urls: string[];
  caption: string | null;
  /** ISO com fuso (UTC). */
  scheduled_at: string;
  status: InstagramPostStatus;
  attempts: number;
  next_attempt_at: string | null;
  error_message: string | null;
  ig_media_id: string | null;
  permalink: string | null;
  published_at: string | null;
  created_by: number | null;
  created_at: string;
};

export type InstagramPostInput = {
  client_id: number;
  media_type: InstagramMediaType;
  media_urls: string[];
  caption: string | null;
  /** ISO com fuso. Ignorado com publish_now. */
  scheduled_at?: string | null;
  publish_now?: boolean;
  calendar_entry_id?: number | null;
};

export type InstagramPostUpdate = Partial<Pick<InstagramPostInput, "media_type" | "media_urls" | "caption" | "scheduled_at">>;

export type InsightsMetrics = Record<string, number>;

export type AccountInsights = { metrics: InsightsMetrics; approximate: string[] };

export type PostInsightsItem = {
  id: string;
  caption: string | null;
  media_type: "IMAGE" | "VIDEO" | "REELS" | "CAROUSEL";
  thumbnail_url: string | null;
  permalink: string | null;
  posted_at: string;
  metrics: InsightsMetrics;
  insights_available: boolean;
};

export type PostsInsights = {
  posts: PostInsightsItem[];
  totals: Record<string, number>;
  by_type: Record<string, number>;
  total_posts: number;
  truncated: boolean;
};

export type InsightsRange = { since: string; until: string } | null;
