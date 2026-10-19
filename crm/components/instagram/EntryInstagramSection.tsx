"use client";

import { useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";
import { useInstagramAccount } from "@/hooks/useInstagram";
import { createPost, deletePost, fetchPostsByEntries, publishPostNow, updatePost } from "@/services/client/instagramApi";
import InstagramPostForm, { type InstagramPostFormValues } from "./InstagramPostForm";
import InstagramPostItem from "./InstagramPostItem";
import type { CalendarEntry } from "@/types/calendar";
import type { InstagramPost, InstagramPostUpdate } from "@/types/instagram";

type Props = {
  entry: CalendarEntry;
  /** Arte e legenda que estão no formulário agora (podem ainda não ter sido salvas). */
  finalImage: string | null;
  caption: string;
  canManage: boolean;
  /** Avisa o quadro pra atualizar o badge do card. */
  onChanged?: () => void;
};

/** Agendamento no Instagram de uma postagem aprovada, dentro do drawer da Produção. */
export default function EntryInstagramSection({ entry, finalImage, caption, canManage, onChanged }: Props) {
  const { account, loading: accountLoading } = useInstagramAccount(entry.client_id);
  const [post, setPost] = useState<InstagramPost | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchPostsByEntries([entry.id]);
      setPost(data[String(entry.id)] ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar o agendamento.");
    } finally {
      setLoaded(true);
    }
  }, [entry.id]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  // Enquanto estiver saindo, acompanha até assentar.
  useEffect(() => {
    if (!post) return;
    const due = post.status === "publicando" || (post.status === "pendente" && new Date(post.scheduled_at).getTime() <= Date.now());
    if (!due) return;
    const timer = window.setTimeout(load, 10_000);
    return () => window.clearTimeout(timer);
  }, [post, load]);

  async function after(action: () => Promise<unknown>) {
    await action();
    await load();
    onChanged?.();
  }

  async function handleCreate(values: InstagramPostFormValues) {
    await after(() => createPost({ client_id: entry.client_id, calendar_entry_id: entry.id, ...values }));
    setCreating(false);
  }

  const approved = entry.status === "finalizados";
  const connected = account?.status === "ativo";

  // Postagem que não está aprovada e nunca foi agendada: nada a mostrar.
  if (!loaded || (!post && !approved)) return null;

  return (
    // Enter num campo daqui não pode enviar o formulário da postagem (o drawer é um <form>).
    <section
      className="space-y-3"
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault();
      }}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Send className="h-4 w-4 text-white/40" />
        Instagram
      </div>

      {post ? (
        <InstagramPostItem
          post={post}
          canManage={canManage}
          onUpdate={(id: number, input: InstagramPostUpdate) => after(() => updatePost(id, input))}
          onPublishNow={(id: number) => after(() => publishPostNow(id))}
          onRemove={(id: number) => after(() => deletePost(id))}
        />
      ) : accountLoading ? (
        <p className="text-xs text-white/50">Carregando...</p>
      ) : !connected ? (
        <p className="text-xs text-white/50">
          O Instagram desse cliente não está conectado. Conecte em Clientes → aba Instagram.
        </p>
      ) : !canManage ? (
        <p className="text-xs text-white/50">Ainda não agendado no Instagram.</p>
      ) : creating ? (
        <div className="rounded-xl border border-cyan/30 bg-white/5 p-3">
          <InstagramPostForm
            initial={{ mediaUrls: finalImage ? [finalImage] : [], caption, date: entry.scheduled_date }}
            submitLabel="Agendar"
            onSubmit={handleCreate}
            onCancel={() => setCreating(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="w-full rounded-lg border border-white/15 px-4 py-2 text-sm text-white transition hover:border-cyan/50"
        >
          Agendar no Instagram{account?.username ? ` (@${account.username})` : ""}
        </button>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </section>
  );
}
