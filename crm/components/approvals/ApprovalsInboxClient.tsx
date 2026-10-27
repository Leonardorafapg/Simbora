"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { usePendingApprovals } from "@/hooks/usePendingApprovals";
import CalendarApprovalPanel from "@/components/calendar/CalendarApprovalPanel";
import ApprovalSchedule from "./ApprovalSchedule";
import { MONTH_LABELS } from "@/types/calendar";
import type { CalendarPeriodPending } from "@/types/calendarPeriod";

/**
 * Caixa de entrada central: todo cliente com calendário aguardando a aprovação da Amanda,
 * sem precisar entrar cliente por cliente pra achar. Aprova ou reprova aqui mesmo.
 */
export default function ApprovalsInboxClient() {
  const { items, loading, error, refresh } = usePendingApprovals();

  const waiting = items.filter((i) => i.status === "enviado_aprovacao_amanda");

  return (
    <div className="space-y-8 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold text-text">Aprovações</h1>
        <p className="text-sm text-text-muted">Calendários dos clientes aguardando aprovação.</p>
      </div>

      {loading && <p className="text-sm text-text-muted">Carregando...</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-text-muted">Nenhuma aprovação pendente no momento.</p>
      )}

      {waiting.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-text">Aguardando sua aprovação</h2>
          <div className="space-y-3">
            {waiting.map((item) => (
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
        <span className="shrink-0 rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-semibold text-amber-400">
          Aguardando você
        </span>
        <span className="hidden shrink-0 text-xs font-semibold text-accent sm:block">{open ? "Fechar" : "Abrir"}</span>
      </button>

      {open && (
        <div className="animate-fade-up space-y-3 border-t border-border px-4 pb-4 pt-3">
          <ApprovalSchedule item={item} monthLabel={monthLabel} />
          <CalendarApprovalPanel
            clientId={item.client_id}
            year={item.year}
            month={item.month}
            status={item.status}
            entries={[]}
            canSend={false}
            canApprove
            onChanged={onChanged}
          />
        </div>
      )}
    </div>
  );
}
