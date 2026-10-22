"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { usePendingApprovals } from "@/hooks/usePendingApprovals";
import CalendarApprovalPanel from "@/components/calendar/CalendarApprovalPanel";
import ApprovalSchedule from "./ApprovalSchedule";
import { MONTH_LABELS } from "@/types/calendar";
import type { CalendarPeriodPending } from "@/types/calendarPeriod";

function groupLabel(status: CalendarPeriodPending["status"]) {
  return status === "enviado_aprovacao_amanda" ? "Aguardando sua aprovação" : "Aguardando aprovação do cliente";
}

/**
 * Caixa de entrada central: todo cliente com calendário em alguma etapa da
 * cadeia de aprovação, sem precisar entrar cliente por cliente pra achar.
 * "Aguardando sua aprovação" é acionável aqui mesmo; "Aguardando aprovação
 * do cliente" é só visibilidade (decisão é do cliente, pelo link no WhatsApp).
 */
export default function ApprovalsInboxClient() {
  const { items, loading, error, refresh } = usePendingApprovals();

  const waitingAmanda = items.filter((i) => i.status === "enviado_aprovacao_amanda");
  const waitingClient = items.filter((i) => i.status === "enviado_aprovacao_cliente");

  return (
    <div className="space-y-8 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold text-text">Aprovações</h1>
        <p className="text-sm text-text-muted">Calendários dos clientes em alguma etapa de aprovação.</p>
      </div>

      {loading && <p className="text-sm text-text-muted">Carregando...</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-text-muted">Nenhuma aprovação pendente no momento.</p>
      )}

      {waitingAmanda.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-text">{groupLabel("enviado_aprovacao_amanda")}</h2>
          <div className="space-y-3">
            {waitingAmanda.map((item) => (
              <ApprovalCard key={`${item.client_id}-${item.year}-${item.month}`} item={item} onChanged={refresh} />
            ))}
          </div>
        </section>
      )}

      {waitingClient.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-text">{groupLabel("enviado_aprovacao_cliente")}</h2>
          <div className="space-y-3">
            {waitingClient.map((item) => (
              <ApprovalCard key={`${item.client_id}-${item.year}-${item.month}`} item={item} onChanged={refresh} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function formatSentAt(iso: string) {
  // updated_at vem do backend em UTC, sem fuso: lê como UTC e mostra no horário local.
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/**
 * Cartão comprimido: só o cliente, o mês e quando foi enviado. Ao abrir, aparece o cronograma
 * (tabela igual ao PDF ou calendário) e, logo abaixo, os botões de aprovar ou reprovar.
 */
function ApprovalCard({ item, onChanged }: { item: CalendarPeriodPending; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const monthLabel = `${MONTH_LABELS[item.month - 1]} ${item.year}`;
  const sentAt = formatSentAt(item.updated_at);
  const actionable = item.status === "enviado_aprovacao_amanda";

  return (
    <div className="glass-card overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/50"
      >
        <ChevronRight className={`h-4 w-4 shrink-0 text-text-muted transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-text">{item.client_name}</span>
          <span className="block text-xs text-text-muted">
            {monthLabel}
            {sentAt ? ` · enviado em ${sentAt}` : ""}
          </span>
        </span>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            actionable ? "bg-amber-400/15 text-amber-400" : "bg-sky-400/15 text-sky-400"
          }`}
        >
          {actionable ? "Aguardando você" : "Aguardando o cliente"}
        </span>
        <span className="hidden shrink-0 text-xs font-semibold text-accent sm:block">{open ? "Fechar" : "Abrir"}</span>
      </button>

      {open && (
        <div className="animate-fade-up space-y-3 border-t border-border px-4 pb-4 pt-3">
          <ApprovalSchedule item={item} monthLabel={monthLabel} />
          <CalendarApprovalPanel
            clientId={item.client_id}
            clientName={item.client_name}
            year={item.year}
            month={item.month}
            monthLabel={monthLabel}
            status={item.status}
            entries={[]}
            canSend={false}
            canApprove
            pdfUrl={item.pdf_url}
            onChanged={onChanged}
          />
        </div>
      )}
    </div>
  );
}
