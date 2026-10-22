"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useInstagramAccount, useInstagramIntegration, useInstagramPosts } from "@/hooks/useInstagram";
import InstagramConnectionCard from "./InstagramConnectionCard";
import InstagramInsights from "./InstagramInsights";
import InstagramPostForm, { type InstagramPostFormValues } from "./InstagramPostForm";
import InstagramPostItem from "./InstagramPostItem";

type Props = {
  clientId: number;
  canManage: boolean;
};

/** Aba Instagram do cliente: conexão, agendamentos avulsos e métricas. */
export default function InstagramPanel({ clientId, canManage }: Props) {
  const configured = useInstagramIntegration();
  const { account, loading, waiting, connect, getConnectLink, cancelWaiting, disconnect } = useInstagramAccount(clientId);
  const { posts, loading: postsLoading, error: postsError, create, update, publishNow, remove } = useInstagramPosts(clientId);
  const [view, setView] = useState<"posts" | "metrics">("posts");
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<"todos" | "fila" | "publicado" | "erro">("todos");

  const connected = account?.status === "ativo";
  const visible = posts.filter((p) =>
    filter === "todos" ? true : filter === "fila" ? p.status === "pendente" || p.status === "publicando" : p.status === filter,
  );
  const errorCount = posts.filter((p) => p.status === "erro").length;

  async function handleCreate(values: InstagramPostFormValues) {
    await create({ client_id: clientId, ...values });
    setCreating(false);
  }

  return (
    <div className="space-y-4">
      <InstagramConnectionCard
        account={account}
        loading={loading}
        configured={configured}
        waiting={waiting}
        canManage={canManage}
        onConnect={connect}
        onGetLink={getConnectLink}
        onCancelWaiting={cancelWaiting}
        onDisconnect={disconnect}
      />

      {(connected || posts.length > 0) && (
        <div className="flex gap-1 rounded-xl bg-surface-2 p-1 text-sm">
          {(["posts", "metrics"] as const).map((key) => (
            <button
              key={key}
              type="button"
              disabled={key === "metrics" && !connected}
              onClick={() => setView(key)}
              className={`flex-1 rounded-lg px-3 py-1.5 font-semibold transition disabled:opacity-40 ${
                view === key ? "bg-white/15 text-text" : "text-text-muted hover:text-text"
              }`}
            >
              {key === "posts" ? "Agendamentos" : "Métricas"}
            </button>
          ))}
        </div>
      )}

      {view === "metrics" && connected && <InstagramInsights clientId={clientId} />}

      {view === "posts" && (connected || posts.length > 0) && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="glass-input rounded-lg px-3 py-2 text-sm outline-none"
              aria-label="Filtrar agendamentos"
            >
              <option value="todos">Todos</option>
              <option value="fila">Na fila</option>
              <option value="publicado">Publicados</option>
              <option value="erro">Com erro{errorCount ? ` (${errorCount})` : ""}</option>
            </select>
            {canManage && connected && !creating && (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="ml-auto flex items-center gap-2 rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-dark"
              >
                <Plus className="h-4 w-4" /> Agendar post
              </button>
            )}
          </div>

          {creating && (
            <div className="glass-card rounded-2xl p-4">
              <p className="mb-3 text-sm font-semibold text-text">Novo post</p>
              <InstagramPostForm submitLabel="Agendar" onSubmit={handleCreate} onCancel={() => setCreating(false)} />
            </div>
          )}

          {postsLoading && <p className="text-sm text-text-muted">Carregando...</p>}
          {postsError && <p className="text-sm text-danger">{postsError}</p>}
          {!postsLoading && visible.length === 0 && !creating && (
            <p className="text-sm text-text-muted">
              {posts.length ? "Nenhum post com esse filtro." : "Nenhum post agendado. Agende aqui ou pelo card aprovado na Produção."}
            </p>
          )}
          <div className="space-y-2">
            {visible.map((post) => (
              <InstagramPostItem
                key={post.id}
                post={post}
                canManage={canManage}
                onUpdate={update}
                onPublishNow={publishNow}
                onRemove={remove}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
