"use client";

import { useEffect, useRef, useState } from "react";
import { AlignLeft, CalendarDays, Clock, ExternalLink, ImagePlus, Paperclip, UserRound, Users, X } from "lucide-react";
import type { CalendarEntry, CalendarEntryCreateInput, CalendarEntryUpdateInput } from "@/types/calendar";
import type { Client } from "@/types/client";
import { useClients } from "@/hooks/useClients";
import { useTeamDirectory } from "@/hooks/useTeamDirectory";
import UserSelect from "@/components/ui/UserSelect";
import TagPicker from "./TagPicker";
import { DEADLINE_CLASSES, DEADLINE_LABELS, deadlineFor, deadlineInfo, formatDeadline } from "@/lib/deadline";
import AttachmentGrid from "@/components/ui/AttachmentGrid";
import LinkList from "@/components/ui/LinkList";
import { extractLinks, linkLabel } from "@/lib/links";
import { isImageUrl } from "@/lib/artwork";
import { switchPostType, withSlides } from "@/lib/postMedia";
import EntryInstagramSection from "@/components/instagram/EntryInstagramSection";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Cliente fixo do drawer — não há seletor, todo entry pertence a esse cliente. */
  clientId: number;
  defaultDate: string;
  /** Quando informado, uma nova postagem mostra um seletor de cliente (em vez de cliente fixo). */
  clients?: Client[];
  entry?: CalendarEntry | null;
  canDelete?: boolean;
  onCreate: (input: CalendarEntryCreateInput) => Promise<CalendarEntry>;
  onUpdate: (id: number, input: CalendarEntryUpdateInput) => Promise<CalendarEntry>;
  onRequestDelete?: (entry: CalendarEntry) => void;
  /** Mostra o agendamento no Instagram (só no quadro de Produção). */
  instagram?: { canView: boolean; canManage: boolean; onChanged?: () => void };
};

function buildForm(
  entry: CalendarEntry | null | undefined,
  clientId: number,
  defaultDate: string,
  client?: Client,
) {
  return {
    client_id: entry?.client_id ?? clientId,
    // Nova postagem: solicitante = social do cliente, responsável = designer do cliente.
    requester_id: entry ? entry.requester_id : (client?.default_social_id ?? null),
    assignee_id: entry ? entry.assignee_id : (client?.default_designer_id ?? null),
    scheduled_date: entry?.scheduled_date ?? defaultDate,
    custom_deadline: entry?.custom_deadline ?? null,
    tag_ids: entry?.tags.map((t) => t.id) ?? ([] as number[]),
    title: entry?.title ?? "",
    theme: entry?.theme ?? "",
    reference_image: entry?.reference_image ?? null,
    material_files: entry?.material_files ?? [],
    // Postagens antigas guardavam um único link de referência no campo reference_link.
    reference_links: entry?.reference_links?.length ? entry.reference_links : entry?.reference_link ? [entry.reference_link] : [],
    material_links: entry?.material_links ?? [],
    final_image: entry?.final_image ?? null,
    final_image_story: entry?.final_image_story ?? null,
    post_type: entry?.post_type ?? ("feed" as "feed" | "carousel"),
    final_images: entry?.final_images ?? ([] as string[]),
    caption: entry?.caption ?? "",
  };
}

export default function CalendarEntryDialog({
  open,
  onClose,
  clientId,
  defaultDate,
  clients,
  entry,
  canDelete = false,
  onCreate,
  onUpdate,
  onRequestDelete,
  instagram,
}: Props) {
  const { clients: allClients } = useClients();
  const { members } = useTeamDirectory();
  const clientList = clients ?? allClients;
  const findClient = (id: number) => clientList.find((c) => c.id === id);

  const [form, setForm] = useState(() => buildForm(entry, clientId, defaultDate, findClient(clientId)));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [openKey, setOpenKey] = useState(entry?.id ?? "new");
  // Foto do formulário ao abrir: serve para avisar antes de descartar alterações não salvas.
  const [initialJson, setInitialJson] = useState(() => JSON.stringify(buildForm(entry, clientId, defaultDate, findClient(clientId))));
  const closeRef = useRef<() => void>(() => {});
  // Slides do carrossel de antes de voltar pro Feed, pra um clique errado não perder o trabalho.
  const slidesStash = useRef<string[]>([]);

  // Reabre o form do zero quando o dialog é reaberto para uma entrada diferente.
  const currentKey = entry?.id ?? "new";
  if (currentKey !== openKey && open) {
    const fresh = buildForm(entry, clientId, defaultDate, findClient(clientId));
    setForm(fresh);
    setInitialJson(JSON.stringify(fresh));
    setOpenKey(currentKey);
  }

  useEffect(() => {
    closeRef.current = requestClose;
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setPostType(type: "feed" | "carousel") {
    if (form.post_type === "carousel") slidesStash.current = form.final_images;
    setForm((prev) => ({ ...prev, ...switchPostType(prev, type, slidesStash.current) }));
  }

  function handleClose() {
    setError(null);
    onClose();
  }

  /** Fechar por X, Esc ou clique fora: pergunta antes de perder alterações não salvas. */
  function requestClose() {
    if (JSON.stringify(form) !== initialJson && !window.confirm("Descartar as alterações não salvas?")) return;
    handleClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (entry) {
        await onUpdate(entry.id, form);
      } else {
        await onCreate(form);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  // Layout em dois painéis (estilo card do Trello): à esquerda o conteúdo da
  // postagem (descrição, execução, anexos); à direita data e entrega.
  const labelCls = "flex items-center gap-2 text-sm font-semibold text-text";
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="glass-modal animate-slide-in-right flex h-full w-full max-w-6xl flex-col overflow-hidden sm:rounded-l-2xl"
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-4 sm:px-6">
          <span className="rounded bg-surface-2 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-text">
            {entry ? "Editar postagem" : clients ? "Nova demanda" : "Nova postagem"}
          </span>
          <button
            type="button"
            onClick={requestClose}
            className="shrink-0 rounded-full p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          <div className="min-w-0 space-y-4 p-4 sm:p-6 lg:flex-[3] lg:overflow-y-auto">
            <section>
              <input
                required={!entry}
                value={form.title}
                maxLength={200}
                onChange={(e) => update("title", e.target.value)}
                placeholder="Nome da publicação"
                aria-label="Nome da publicação"
                className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 -mx-2 text-xl font-bold sm:text-2xl text-text outline-none placeholder:text-text-faint hover:border-border focus:border-cyan/50 focus:bg-surface-2"
              />
            </section>

            <TagPicker selectedIds={form.tag_ids} onChange={(ids) => update("tag_ids", ids)} />

            <section className="grid gap-4 sm:grid-cols-2 rounded-xl border border-border bg-surface-2/40 p-4">
              <div className="space-y-2">
                <div className={labelCls}>
                  <UserRound className="h-4 w-4 text-text-faint" />
                  Solicitante
                </div>
                <UserSelect
                  options={members}
                  value={form.requester_id}
                  onChange={(value) => update("requester_id", value)}
                />
              </div>
              <div className="space-y-2">
                <div className={labelCls}>
                  <UserRound className="h-4 w-4 text-text-faint" />
                  Responsável
                </div>
                <UserSelect
                  options={members}
                  value={form.assignee_id}
                  onChange={(value) => update("assignee_id", value)}
                />
              </div>
            </section>

            <section className="space-y-2 rounded-xl border border-border bg-surface-2/40 p-4">
              <div className={labelCls}>
                <AlignLeft className="h-4 w-4 text-text-faint" />
                Descrição
              </div>
              <textarea
                required
                value={form.theme}
                onChange={(e) => update("theme", e.target.value)}
                placeholder="Tema / chamada do post"
                className="glass-input min-h-[110px] w-full rounded-lg px-3 py-2 text-base outline-none"
              />
              <DetectedLinks text={form.theme} />
            </section>

            <section className="space-y-3 rounded-xl border border-border bg-surface-2/40 p-4">
              <div className={labelCls}>
                <Paperclip className="h-4 w-4 text-text-faint" />
                Anexos
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-xs text-text-muted">Referência</p>
                  <AttachmentGrid
                    max={1}
                    addLabel="Referência"
                    value={form.reference_image ? [form.reference_image] : []}
                    onChange={(urls) => update("reference_image", urls[0] ?? null)}
                  />
                  <div className="mt-3">
                    <LinkList
                      value={form.reference_links}
                      onChange={(links) => update("reference_links", links)}
                      placeholder="Link de referência (Drive, Figma...)"
                    />
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs text-text-muted">Material</p>
                  <AttachmentGrid
                    addLabel="Adicionar material"
                    value={form.material_files}
                    onChange={(urls) => update("material_files", urls)}
                  />
                  <div className="mt-3">
                    <LinkList
                      value={form.material_links}
                      onChange={(links) => update("material_links", links)}
                      placeholder="Link do material (pasta do Drive...)"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside className="min-w-0 space-y-4 border-t border-border bg-surface-2/20 p-4 sm:p-6 lg:flex-[2] lg:overflow-y-auto lg:border-l lg:border-t-0">
            {clients && (
              <section className="space-y-2 rounded-xl border border-border bg-surface-2/40 p-4">
                <div className={labelCls}>
                  <Users className="h-4 w-4 text-text-faint" />
                  Cliente
                </div>
                <select
                  required
                  value={form.client_id}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    const client = findClient(id);
                    setForm((prev) => ({
                      ...prev,
                      client_id: id,
                      // Só troca solicitante/responsável pro padrão do cliente
                      // na criação — editando, não mexe em quem já tava
                      // atribuído (pode ter sido escolhido de propósito).
                      ...(entry
                        ? {}
                        : {
                            requester_id: client?.default_social_id ?? null,
                            assignee_id: client?.default_designer_id ?? null,
                          }),
                    }));
                  }}
                  className="glass-input w-full rounded-lg px-3 py-2 text-sm outline-none"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </section>
            )}

            <section className="space-y-2 rounded-xl border border-border bg-surface-2/40 p-4">
              <div className={labelCls}>
                <CalendarDays className="h-4 w-4 text-text-faint" />
                Data
              </div>
              <input
                required
                type="date"
                value={form.scheduled_date}
                onChange={(e) => update("scheduled_date", e.target.value)}
                className="glass-input w-full rounded-lg px-3 py-2 text-sm outline-none"
              />
            </section>

            <section className="space-y-2 rounded-xl border border-border bg-surface-2/40 p-4">
              <div className={labelCls}>
                <Clock className="h-4 w-4 text-text-faint" />
                Prazo de entrega
              </div>
              {(clients && !entry) || entry?.from_production ? (
                <>
                  <input
                    type="date"
                    value={form.custom_deadline ?? deadlineFor(form.scheduled_date)}
                    onChange={(e) => update("custom_deadline", e.target.value)}
                    className="glass-input w-full rounded-lg px-3 py-2 text-sm outline-none"
                  />
                  {entry ? (
                    (() => {
                      const info = deadlineInfo({ ...entry, scheduled_date: form.scheduled_date, custom_deadline: form.custom_deadline });
                      return (
                        <div className="flex flex-wrap items-center gap-2 text-sm text-text">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${DEADLINE_CLASSES[info.state]}`}>
                            {DEADLINE_LABELS[info.state]}
                            {info.daysLate > 0 ? ` (${info.daysLate}d)` : ""}
                          </span>
                        </div>
                      );
                    })()
                  ) : (
                    <p className="text-xs text-text-faint">
                      Demanda fora do calendário — ajuste o prazo manualmente (sugestão: quinta da semana anterior).
                    </p>
                  )}
                </>
              ) : (
                (() => {
                  const info = entry ? deadlineInfo({ ...entry, scheduled_date: form.scheduled_date }) : null;
                  return (
                    <>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-text">
                        <span>{formatDeadline(info?.deadline ?? deadlineFor(form.scheduled_date))}</span>
                        {info && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${DEADLINE_CLASSES[info.state]}`}>
                            {DEADLINE_LABELS[info.state]}
                            {info.daysLate > 0 ? ` (${info.daysLate}d)` : ""}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-faint">
                        {entry?.custom_deadline ? "Prazo customizado." : "Quinta-feira da semana anterior à data da postagem."}
                      </p>
                    </>
                  );
                })()
              )}
            </section>

            {/* Sempre visível (inclusive ao criar): o post pronto e a legenda
                podem já existir quando a demanda é cadastrada. */}
            <section className="space-y-3 rounded-xl border border-border bg-surface-2/40 p-4">
              <div className={labelCls}>
                <ImagePlus className="h-4 w-4 text-text-faint" />
                Post feito
              </div>
              <div className="flex gap-1.5">
                {([["feed", "Feed"], ["carousel", "Carrossel"]] as const).map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPostType(type)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      form.post_type === type ? "bg-cyan text-black" : "bg-surface-2 text-text-muted hover:text-text"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className={form.post_type === "carousel" ? "space-y-4" : "grid gap-4 sm:grid-cols-2"}>
                <div>
                  {form.post_type === "carousel" ? (
                    <>
                      <p className="mb-1.5 text-xs text-text-muted">Slides do carrossel (na ordem de publicação, 2 a 10)</p>
                      <AttachmentGrid
                        max={10}
                        reorderable
                        addLabel="Adicionar slide"
                        value={form.final_images}
                        onChange={(urls) => setForm((prev) => ({ ...prev, ...withSlides(urls) }))}
                      />
                    </>
                  ) : (
                    <>
                      <p className="mb-1.5 text-xs text-text-muted">Arte final do post (Feed)</p>
                      <AttachmentGrid
                        max={1}
                        addLabel="Arte do Feed"
                        value={form.final_image ? [form.final_image] : []}
                        onChange={(urls) => update("final_image", urls[0] ?? null)}
                      />
                    </>
                  )}
                </div>
                <div>
                  <p className="mb-1.5 text-xs text-text-muted">Arte para Stories (opcional)</p>
                  <AttachmentGrid
                    max={1}
                    addLabel="Arte do Stories"
                    value={form.final_image_story ? [form.final_image_story] : []}
                    onChange={(urls) => update("final_image_story", urls[0] ?? null)}
                  />
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs text-text-muted">Legenda</p>
                <textarea
                  value={form.caption}
                  onChange={(e) => update("caption", e.target.value)}
                  placeholder="Legenda que vai junto com a postagem"
                  className="glass-input min-h-[160px] w-full rounded-lg px-3 py-2 text-sm outline-none"
                />
                <DetectedLinks text={form.caption} />
              </div>
            </section>

            {entry && instagram?.canView && (
              <EntryInstagramSection
                entry={entry}
                finalImage={isImageUrl(form.final_image) ? form.final_image : null}
                carouselImages={form.post_type === "carousel" ? form.final_images.filter((u) => isImageUrl(u)) : null}
                caption={form.caption}
                canManage={instagram.canManage}
                onChanged={instagram.onChanged}
              />
            )}
          </aside>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-6 py-3">
          {error && <p className="mr-auto text-sm text-danger">{error}</p>}
          {entry && canDelete && onRequestDelete && (
            <button
              type="button"
              onClick={() => onRequestDelete(entry)}
              className="rounded-lg px-4 py-2 text-sm text-danger hover:text-danger/70"
            >
              Remover
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-dark disabled:opacity-60"
          >
            {loading ? "Salvando..." : entry ? "Salvar alterações" : "Criar"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Links digitados no meio do texto: o campo é editável (não dá pra clicar nele), então aparecem aqui, clicáveis. */
function DetectedLinks({ text }: { text: string }) {
  const links = extractLinks(text);
  if (links.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5 pt-1">
      {links.map((href) => (
        <li key={href}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={href}
            className="inline-flex max-w-[16rem] items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent hover:underline"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{linkLabel(href)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
