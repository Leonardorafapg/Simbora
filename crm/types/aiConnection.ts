export type AiConnection = {
  id: number;
  user_id: number;
  client_name: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
};
