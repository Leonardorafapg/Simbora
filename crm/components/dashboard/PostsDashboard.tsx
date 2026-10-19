"use client";

import { useMemo } from "react";
import { useCalendarEntries } from "@/hooks/useCalendarEntries";
import { useClients } from "@/hooks/useClients";
import { CALENDAR_ENTRY_STATUSES, CALENDAR_ENTRY_STATUS_LABELS } from "@/types/calendar";
import { deadlineInfo } from "@/lib/deadline";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Visão geral das postagens do mês atual, de todos os clientes. */
export default function PostsDashboard() {
  const month = currentMonth();
  const { entries, loading, error } = useCalendarEntries(undefined, month);
  const { clients } = useClients();

  const stats = useMemo(() => {
    const byStatus = CALENDAR_ENTRY_STATUSES.map((status) => ({
      status,
      label: CALENDAR_ENTRY_STATUS_LABELS[status],
      count: entries.filter((e) => e.status === status).length,
    }));
    const infos = entries.map((e) => deadlineInfo(e).state);
    const atrasadas = infos.filter((s) => s === "atrasado").length;
    const vencendo = infos.filter((s) => s === "vence_hoje" || s === "vence_amanha").length;
    const noPrazo = infos.filter((s) => s === "entregue_no_prazo").length;
    const comAtraso = infos.filter((s) => s === "entregue_atrasado").length;

    const byClient = new Map<number, { total: number; concluidas: number }>();
    for (const e of entries) {
      const cur = byClient.get(e.client_id) ?? { total: 0, concluidas: 0 };
      cur.total += 1;
      if (e.status === "finalizados" || e.status === "publicados") cur.concluidas += 1;
      byClient.set(e.client_id, cur);
    }
    const clientVolume = [...byClient.entries()]
      .map(([clientId, v]) => ({
        clientId,
        name: clients.find((c) => c.id === clientId)?.name ?? "Sem cliente",
        ...v,
      }))
      .sort((a, b) => b.total - a.total);

    return { total: entries.length, atrasadas, vencendo, noPrazo, comAtraso, byStatus, clientVolume };
  }, [entries, clients]);

  if (loading) return <p className="text-sm text-white/50">Carregando...</p>;
  if (error) return <p className="text-sm text-danger">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-white/50">Postagens do mês</p>
          <p className="text-2xl font-semibold text-white">{stats.total}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-white/50">Entregas atrasadas</p>
          <p className="text-2xl font-semibold text-danger">{stats.atrasadas}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-white/50">Vencem hoje ou amanhã</p>
          <p className="text-2xl font-semibold text-amber-400">{stats.vencendo}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-white/50">Entregues no prazo</p>
          <p className="text-2xl font-semibold text-emerald-400">{stats.noPrazo}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-white/50">Entregues com atraso</p>
          <p className="text-2xl font-semibold text-amber-400">{stats.comAtraso}</p>
        </div>
        {stats.byStatus
          .filter((s) => s.status === "finalizados" || s.status === "publicados" || s.status === "modificacoes")
          .map((s) => (
            <div key={s.status} className="glass-card rounded-2xl p-4">
              <p className="text-xs text-white/50">{s.label}</p>
              <p className="text-2xl font-semibold text-white">{s.count}</p>
            </div>
          ))}
      </div>

      <div className="glass-card rounded-2xl p-4 space-y-2">
        <h2 className="text-sm font-semibold text-white">Por status</h2>
        {stats.byStatus.map((s) => (
          <div key={s.status} className="flex items-center justify-between text-sm text-white/80">
            <span>{s.label}</span>
            <span className="font-semibold">{s.count}</span>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-2xl p-4 space-y-2">
        <h2 className="text-sm font-semibold text-white">Por cliente</h2>
        {stats.clientVolume.length === 0 && <p className="text-xs text-white/40">Nenhuma postagem neste mês.</p>}
        {stats.clientVolume.map((c) => (
          <div key={c.clientId} className="flex items-center justify-between text-sm text-white/80">
            <span>{c.name}</span>
            <span>
              {c.concluidas}/{c.total} aprovadas ou publicadas
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
