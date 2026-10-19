import type {
  AccountInsights,
  InsightsMetrics,
  InsightsRange,
  InstagramAccount,
  InstagramPost,
  InstagramPostInput,
  InstagramPostUpdate,
  InstagramProfile,
  PostsInsights,
} from "@/types/instagram";

async function parseErrorMessage(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return data.message ?? fallback;
}

async function request<T>(path: string, fallback: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/instagram/${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, fallback));
  if (res.status === 204) return undefined as T;
  return res.json();
}

const rangeQuery = (range: InsightsRange) => (range ? `?since=${range.since}&until=${range.until}` : "");

export const fetchIntegrationStatus = () =>
  request<{ configured: boolean }>("status", "Não foi possível verificar a integração com o Instagram.");

export const fetchAccount = (clientId: number) =>
  request<InstagramAccount>(`accounts/${clientId}`, "Não foi possível carregar a conexão do Instagram.");

export const fetchProfile = (clientId: number) =>
  request<InstagramProfile>(`accounts/${clientId}/profile`, "Não foi possível carregar o perfil do Instagram.");

export const disconnectAccount = (clientId: number) =>
  request<void>(`accounts/${clientId}`, "Não foi possível desconectar o Instagram.", { method: "DELETE" });

export const fetchConnectUrl = (clientId: number) =>
  request<{ url: string }>(`oauth/connect-url?client_id=${clientId}`, "Não foi possível iniciar a conexão com o Instagram.");

export const fetchPosts = (clientId: number) =>
  request<InstagramPost[]>(`posts?client_id=${clientId}`, "Não foi possível carregar os agendamentos.");

export const fetchPostsByEntries = (entryIds: number[]) =>
  request<Record<string, InstagramPost>>(
    `posts/by-entries?ids=${entryIds.join(",")}`,
    "Não foi possível carregar os agendamentos do Instagram.",
  );

export const createPost = (input: InstagramPostInput) =>
  request<InstagramPost>("posts", "Não foi possível agendar o post.", { method: "POST", body: JSON.stringify(input) });

export const updatePost = (id: number, input: InstagramPostUpdate) =>
  request<InstagramPost>(`posts/${id}`, "Não foi possível salvar o agendamento.", {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const deletePost = (id: number) =>
  request<void>(`posts/${id}`, "Não foi possível remover o agendamento.", { method: "DELETE" });

export const publishPostNow = (id: number) =>
  request<InstagramPost>(`posts/${id}/publish-now`, "Não foi possível publicar agora.", { method: "POST", body: "{}" });

export const fetchPostInsights = (id: number) =>
  request<{ metrics: InsightsMetrics }>(`posts/${id}/insights`, "Não foi possível carregar as métricas do post.");

export const fetchAccountInsights = (clientId: number, range: InsightsRange) =>
  request<AccountInsights>(`insights/account/${clientId}${rangeQuery(range)}`, "Não foi possível carregar as métricas da conta.");

export const fetchPostsInsights = (clientId: number, range: { since: string; until: string }) =>
  request<PostsInsights>(`insights/posts/${clientId}${rangeQuery(range)}`, "Não foi possível carregar as métricas dos posts.");
