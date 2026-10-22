"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { fetchAccountInsights, fetchPostsInsights, fetchProfile } from "@/services/client/instagramApi";
import { METRIC_LABELS, PERIOD_LABELS, formatBrt, formatMetric, rangeFor, type InsightsPeriod } from "@/lib/instagram";
import type { AccountInsights, InstagramProfile, PostsInsights } from "@/types/instagram";

const ACCOUNT_ORDER = [
  "reach", "views", "accounts_engaged", "total_interactions", "likes", "comments", "saves", "shares", "profile_links_taps",
];
const POST_SORTS = [
  ["posted_at", "Mais recentes"],
  ["views", "Visualizações"],
  ["reach", "Alcance"],
  ["total_interactions", "Interações"],
  ["likes", "Curtidas"],
] as const;
type PostSort = (typeof POST_SORTS)[number][0];
const TYPE_LABELS: Record<string, string> = { IMAGE: "Imagem", CAROUSEL: "Carrossel", REELS: "Reels", VIDEO: "Vídeo" };

function MetricTile({ label, value, approximate }: { label: string; value: string; approximate?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <p className="text-[11px] text-white/45">{label}</p>
      <p className="text-lg font-semibold text-text">
        {value}
        {approximate && (
          <span title="Soma de janelas de 30 dias: a mesma pessoa pode ter sido contada mais de uma vez" className="ml-1 cursor-help text-sm text-text-faint">
            ≈
          </span>
        )}
      </p>
    </div>
  );
}

export default function InstagramInsights({ clientId }: { clientId: number }) {
  const [period, setPeriod] = useState<InsightsPeriod>("30");
  const [customSince, setCustomSince] = useState("");
  const [customUntil, setCustomUntil] = useState("");
  const [profile, setProfile] = useState<InstagramProfile | null>(null);
  const [account, setAccount] = useState<AccountInsights | null>(null);
  const [posts, setPosts] = useState<PostsInsights | null>(null);
  // Chave da última consulta concluída — "carregando" é derivado dela.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<PostSort>("posted_at");

  const range = rangeFor(period, customSince, customUntil);
  const rangeKey = range === undefined ? "invalid" : range === null ? "24h" : `${range.since}_${range.until}`;
  const requestKey = `${clientId}:${rangeKey}`;
  const loading = range !== undefined && loadedKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    fetchProfile(clientId)
      .then((data) => !cancelled && setProfile(data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  useEffect(() => {
    if (range === undefined) return;
    let cancelled = false;
    // Posts precisam de período; "24h" mostra os posts de hoje e ontem.
    const today = new Date();
    const postsRange = range ?? {
      since: new Date(today.getTime() - 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
      until: today.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
    };
    // allSettled: se uma das consultas falhar, a outra ainda aparece.
    Promise.allSettled([fetchAccountInsights(clientId, range), fetchPostsInsights(clientId, postsRange)]).then(
      ([accountResult, postsResult]) => {
        if (cancelled) return;
        setAccount(accountResult.status === "fulfilled" ? accountResult.value : null);
        setPosts(postsResult.status === "fulfilled" ? postsResult.value : null);
        const failed = [accountResult, postsResult].find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
        setError(failed ? (failed.reason instanceof Error ? failed.reason.message : "Erro ao buscar métricas.") : null);
        setLoadedKey(requestKey);
      },
    );
    return () => {
      cancelled = true;
    };
    // requestKey resume clientId + `range` (objeto novo a cada render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const sortedPosts = [...(posts?.posts ?? [])].sort((a, b) =>
    sort === "posted_at" ? b.posted_at.localeCompare(a.posted_at) : (b.metrics[sort] ?? 0) - (a.metrics[sort] ?? 0),
  );

  return (
    <div className="space-y-4">
      {profile && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <MetricTile label="Seguidores" value={(profile.followers_count ?? 0).toLocaleString("pt-BR")} />
          <MetricTile label="Publicações" value={(profile.media_count ?? 0).toLocaleString("pt-BR")} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as InsightsPeriod)}
          className="glass-input rounded-lg px-3 py-2 text-sm outline-none"
          aria-label="Período das métricas"
        >
          {(Object.keys(PERIOD_LABELS) as InsightsPeriod[]).map((key) => (
            <option key={key} value={key}>
              {PERIOD_LABELS[key]}
            </option>
          ))}
        </select>
        {period === "custom" && (
          <>
            <input type="date" value={customSince} onChange={(e) => setCustomSince(e.target.value)} className="glass-input rounded-lg px-3 py-2 text-sm outline-none" aria-label="De" />
            <input type="date" value={customUntil} onChange={(e) => setCustomUntil(e.target.value)} className="glass-input rounded-lg px-3 py-2 text-sm outline-none" aria-label="Até" />
          </>
        )}
        {loading && <span className="text-xs text-text-muted">Carregando...</span>}
      </div>
      {period === "custom" && range === undefined && (
        <p className="text-xs text-text-faint">Escolha as duas datas (a final não pode ser no futuro).</p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}

      {account && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-faint">Conta</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {ACCOUNT_ORDER.filter((key) => key in account.metrics).map((key) => (
              <MetricTile
                key={key}
                label={METRIC_LABELS[key] ?? key}
                value={formatMetric(key, account.metrics[key])}
                approximate={account.approximate.includes(key)}
              />
            ))}
          </div>
        </div>
      )}

      {posts && (
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">
              Posts do período ({posts.total_posts})
            </p>
            <span className="text-xs text-text-faint">
              {Object.entries(posts.by_type).map(([type, count]) => `${TYPE_LABELS[type] ?? type}: ${count}`).join(" · ")}
            </span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as PostSort)}
              className="glass-input ml-auto rounded-lg px-2 py-1 text-xs outline-none"
              aria-label="Ordenar posts"
            >
              {POST_SORTS.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {posts.truncated && (
            <p className="mb-2 text-xs text-text-faint">Mostrando os 60 mais recentes; os totais abaixo somam só esses.</p>
          )}
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["views", "reach", "likes", "comments", "saved", "shares", "total_interactions"] as const).map((key) => (
              <MetricTile key={key} label={`${METRIC_LABELS[key]} (total)`} value={formatMetric(key, posts.totals[key] ?? 0)} />
            ))}
          </div>
          {sortedPosts.length === 0 ? (
            <p className="text-sm text-text-muted">Nenhum post no período.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {sortedPosts.map((post) => (
                <div key={post.id} className="flex gap-3 rounded-xl border border-border bg-surface-2 p-3">
                  {post.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL externa (CDN da Meta)
                    <img src={post.thumbnail_url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded-lg bg-black/30" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                      <span>{TYPE_LABELS[post.media_type] ?? post.media_type}</span>
                      <span>· {formatBrt(post.posted_at)}</span>
                      {post.permalink && (
                        <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="ml-auto text-cyan" aria-label="Abrir no Instagram">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                    {post.caption && <p className="mt-0.5 line-clamp-1 text-xs text-text">{post.caption}</p>}
                    <p className="mt-1 text-xs text-text-muted">
                      {(["views", "reach", "likes", "comments", "saved", "shares"] as const)
                        .filter((key) => post.metrics[key] !== undefined)
                        .map((key) => `${METRIC_LABELS[key]}: ${formatMetric(key, post.metrics[key])}`)
                        .join(" · ")}
                    </p>
                    {!post.insights_available && (
                      <p className="mt-0.5 text-[10px] text-text-faint">Métricas detalhadas indisponíveis para esse post.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
