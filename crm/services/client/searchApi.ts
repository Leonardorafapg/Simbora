import type { SearchResult } from "@/types/search";

export async function fetchSearchResults(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? [];
}
