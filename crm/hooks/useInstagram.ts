"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createPost,
  deletePost,
  disconnectAccount,
  fetchAccount,
  fetchConnectUrl,
  fetchIntegrationStatus,
  fetchPosts,
  fetchPostsByEntries,
  publishPostNow,
  updatePost,
} from "@/services/client/instagramApi";
import { getOrFetch } from "@/lib/dataCache";
import type { InstagramAccount, InstagramPost, InstagramPostInput, InstagramPostUpdate } from "@/types/instagram";

const CONNECT_POLL_MS = 3_000;
const CONNECT_POLL_MAX_MS = 15 * 60_000; // mesma validade do link de autorização
const POSTS_POLL_MS = 10_000;

/** Se o app da Meta está configurado no servidor (sem isso não dá pra conectar). */
export function useInstagramIntegration() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    getOrFetch("instagram-status", fetchIntegrationStatus)
      .then((data) => !cancelled && setConfigured(data.configured))
      .catch(() => !cancelled && setConfigured(false));
    return () => {
      cancelled = true;
    };
  }, []);
  return configured;
}

/**
 * Conexão do Instagram do cliente. Conectar abre a tela da Meta numa aba nova
 * (sem vínculo com esta); a conexão é detectada consultando o backend até mudar
 * (a cada 3s e ao voltar o foco pra esta aba).
 */
export function useInstagramAccount(clientId: number) {
  const [account, setAccount] = useState<InstagramAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const waitStarted = useRef<{ at: number; connectedAt: string | null } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchAccount(clientId);
      setAccount(data);
      setError(null);
      const started = waitStarted.current;
      if (started && data.status === "ativo" && data.connected_at !== started.connectedAt) {
        waitStarted.current = null;
        setWaiting(false);
      }
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  // Montado com key={client.id} (ClientDetail), então trocar de cliente remonta o hook.
  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => {
      const started = waitStarted.current;
      if (!started || Date.now() - started.at > CONNECT_POLL_MAX_MS) {
        waitStarted.current = null;
        setWaiting(false);
        return;
      }
      refresh();
    }, CONNECT_POLL_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [waiting, refresh]);

  async function connect() {
    // Abre a aba ANTES do await: navegador bloqueia popup aberto depois de uma promise.
    const tab = window.open("", "_blank");
    try {
      const { url } = await fetchConnectUrl(clientId);
      if (tab) {
        tab.opener = null; // a aba da Meta não precisa (nem deve) controlar o CRM
        tab.location.href = url;
      }
      else window.location.assign(url);
      waitStarted.current = { at: Date.now(), connectedAt: account?.connected_at ?? null };
      setWaiting(true);
    } catch (err) {
      tab?.close();
      throw err;
    }
  }

  /** Link pro dono da conta abrir no aparelho dele (vale 15 min). */
  async function getConnectLink() {
    const { url } = await fetchConnectUrl(clientId);
    waitStarted.current = { at: Date.now(), connectedAt: account?.connected_at ?? null };
    setWaiting(true);
    return url;
  }

  function cancelWaiting() {
    waitStarted.current = null;
    setWaiting(false);
  }

  async function disconnect() {
    await disconnectAccount(clientId);
    await refresh();
  }

  return { account, loading, error, waiting, refresh, connect, getConnectLink, cancelWaiting, disconnect };
}

const byScheduleDesc = (a: InstagramPost, b: InstagramPost) => b.scheduled_at.localeCompare(a.scheduled_at);

/** Agendamentos do cliente. Enquanto algum estiver saindo, atualiza sozinho. */
export function useInstagramPosts(clientId: number) {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchPosts(clientId);
      setPosts([...data].sort(byScheduleDesc));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  // Post publicando, ou pendente cujo horário já chegou: o resultado sai em
  // segundos/minutos, então consulta de novo até assentar.
  useEffect(() => {
    const inFlight = posts.some(
      (p) => p.status === "publicando" || (p.status === "pendente" && new Date(p.scheduled_at).getTime() <= Date.now()),
    );
    if (!inFlight) return;
    const timer = window.setTimeout(refresh, POSTS_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [posts, refresh]);

  const replace = (post: InstagramPost) =>
    setPosts((prev) => [post, ...prev.filter((p) => p.id !== post.id)].sort(byScheduleDesc));

  async function create(input: InstagramPostInput) {
    const post = await createPost(input);
    replace(post);
    return post;
  }

  async function update(id: number, input: InstagramPostUpdate) {
    const post = await updatePost(id, input);
    replace(post);
    return post;
  }

  async function publishNow(id: number) {
    const post = await publishPostNow(id);
    replace(post);
    return post;
  }

  async function remove(id: number) {
    await deletePost(id);
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  return { posts, loading, error, refresh, create, update, publishNow, remove };
}

/** Agendamento mais recente de cada postagem (badge nos cards da Produção). */
export function useInstagramByEntries(entryIds: number[], enabled: boolean) {
  const [byEntry, setByEntry] = useState<Record<string, InstagramPost>>({});
  const key = enabled ? [...entryIds].sort((a, b) => a - b).join(",") : "";

  const refresh = useCallback(async () => {
    if (!key) return setByEntry({});
    try {
      setByEntry(await fetchPostsByEntries(key.split(",").map(Number)));
    } catch {
      // Badge é informativo: falha aqui não atrapalha o quadro.
    }
  }, [key]);

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  return { byEntry, refresh };
}
