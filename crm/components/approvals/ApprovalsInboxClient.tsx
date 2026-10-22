"use client";

import { usePendingApprovals } from "@/hooks/usePendingApprovals";
import CalendarApprovalPanel from "@/components/calendar/CalendarApprovalPanel";
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
    <div className="space-y-8 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Aprovações</h1>
        <p className="text-sm text-white/50">Calendários dos clientes em alguma etapa de aprovação.</p>
      </div>

      {loading && <p className="text-sm text-white/50">Carregando...</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-white/50">Nenhuma aprovação pendente no momento.</p>
      )}

      {waitingAmanda.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white/70">{groupLabel("enviado_aprovacao_amanda")}</h2>
          <div className="space-y-3">
            {waitingAmanda.map((item) => (
              <ApprovalCard key={`${item.client_id}-${item.year}-${item.month}`} item={item} onChanged={refresh} />
            ))}
          </div>
        </section>
      )}

      {waitingClient.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white/70">{groupLabel("enviado_aprovacao_cliente")}</h2>
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

function ApprovalCard({ item, onChanged }: { item: CalendarPeriodPending; onChanged: () => void }) {
  const monthLabel = `${MONTH_LABELS[item.month - 1]} ${item.year}`;

  return (
    <div className="glass-card rounded-2xl p-4 space-y-3">
      <p className="font-semibold text-white">
        {item.client_name} — {monthLabel}
      </p>
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
  );
}
