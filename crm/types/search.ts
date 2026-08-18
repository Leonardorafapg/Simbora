export type SearchResultType = "client" | "calendar_entry" | "user";

export type SearchResult = {
  type: SearchResultType;
  id: number;
  title: string;
  subtitle: string | null;
  client_id: number | null;
};
