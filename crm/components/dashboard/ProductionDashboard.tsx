"use client";

import { useMemo } from "react";
import { useDemands } from "@/hooks/useDemands";
import { useClients } from "@/hooks/useClients";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import {
  DEMAND_STATUS_LABELS,
  DEMAND_STATUSES,
  demandCompletionHours,
  isDemandCompletedOnTime,
  isDemandOverdue,
  type Demand,
} from "@/types/demand";

function formatHours(hours: number) {
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

export default function ProductionDashboard() {
  const { demands, loading, error } = useDemands({});
  const { clients } = useClients();
  const { members: teamMembers } = useTeamMembers();

  const stats = useMemo(() => {
    const total = demands.length;
    const atrasadas = demands.filter(isDemandOverdue).length;
    const semPrazo = demands.filter((d) => !d.due_date && d.status !== "concluida").length;
    const concluidas = demands.filter((d) => d.status === "concluida").length;

    const byStatus = DEMAND_STATUSES.map((status) => ({
      status,
      label: DEMAND_STATUS_LABELS[status],
      count: demands.filter((d) => d.status === status).length,
    }));

    const withOnTimeInfo = demands
      .map((d) => isDemandCompletedOnTime(d))
      .filter((v): v is boolean => v !== null);
    const noPrazo = withOnTimeInfo.filter(Boolean).length;
    const foraDoPrazo = withOnTimeInfo.length - noPrazo;
    const taxaNoPrazo = withOnTimeInfo.length > 0 ? Math.round((noPrazo / withOnTimeInfo.length) * 100) : null;

    const completionHours = demands.map(demandCompletionHours).filter((v): v is number => v !== null);
    const tempoMedio =
      completionHours.length > 0 ? completionHours.reduce((a, b) => a + b, 0) / completionHours.length : null;

    const byAssignee = new Map<number | null, Demand[]>();
    for (const d of demands) {
      const key = d.assignee_id;
      byAssignee.set(key, [...(byAssignee.get(key) ?? []), d]);
    }
    const workload = [...byAssignee.entries()]
      .map(([assigneeId, list]) => ({
        assigneeId,
        name: teamMembers.find((m) => m.id === assigneeId)?.full_name ?? "Sem responsável",
        total: list.length,
        atrasadas: list.filter(isDemandOverdue).length,
        concluidas: list.filter((d) => d.status === "concluida").length,
      }))
      .sort((a, b) => b.total - a.total);

    const byClient = new Map<number | null, Demand[]>();
    for (const d of demands) {
      const key = d.client_id;
      byClient.set(key, [...(byClient.get(key) ?? []), d]);
    }
    const clientVolume = [...byClient.entries()]
      .map(([clientId, list]) => ({
        clientId,
        name: clients.find((c) => c.id === clientId)?.name ?? "Sem cliente",
        total: list.length,
        atrasadas: list.filter(isDemandOverdue).length,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    return { total, atrasadas, semPrazo, concluidas, byStatus, taxaNoPrazo, noPrazo, foraDoPrazo, tempoMedio, workload, clientVolume };
  }, [demands, clients, teamMembers]);

  if (loading) return <p className="text-sm text-white/50">Carregando...</p>;
  if (error) return <p className="text-sm text-danger">{error}</p>;

  const cards = [
    { label: "Total de demandas", value: stats.total, color: "text-white" },
    { label: "Atrasadas", value: stats.atrasadas, color: "text-danger" },
    { label: "Sem prazo definido", value: stats.semPrazo, color: "text-white/70" },
    { label: "Concluídas", value: stats.concluidas, color: "text-emerald-400" },
    {
      label: "Concluídas no prazo",
      value: stats.taxaNoPrazo !== null ? `${stats.taxaNoPrazo}%` : "—",
      color: "text-cyan",
    },
    {
      label: "Tempo médio de conclusão",
      value: stats.tempoMedio !== null ? formatHours(stats.tempoMedio) : "—",
      color: "text-white",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((stat) => (
          <div key={stat.label} className="glass-card rounded-2xl p-4">
            <p className={`text-2xl font-semibold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-white/40 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white">Demandas por status</h2>
          <div className="space-y-2">
            {stats.byStatus.map((s) => (
              <div key={s.status} className="flex items-center gap-3">
                <span className="text-xs text-white/60 w-28 shrink-0">{s.label}</span>
                <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-cyan"
                    style={{ width: stats.total > 0 ? `${(s.count / stats.total) * 100}%` : "0%" }}
                  />
                </div>
                <span className="text-xs text-white/60 w-6 text-right">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white">Carga por responsável</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {stats.workload.length === 0 && <p className="text-xs text-white/40">Sem dados.</p>}
            {stats.workload.map((w) => (
              <div key={w.assigneeId ?? "none"} className="flex items-center justify-between text-xs">
                <span className="text-white/70">{w.name}</span>
                <span className="text-white/40">
                  {w.total} total · <span className="text-danger">{w.atrasadas} atrasadas</span> ·{" "}
                  <span className="text-emerald-400">{w.concluidas} concluídas</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 space-y-3 lg:col-span-2">
          <h2 className="text-sm font-semibold text-white">Volume por cliente</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {stats.clientVolume.length === 0 && <p className="text-xs text-white/40">Sem dados.</p>}
            {stats.clientVolume.map((c) => (
              <div key={c.clientId ?? "none"} className="flex items-center justify-between text-xs">
                <span className="text-white/70">{c.name}</span>
                <span className="text-white/40">
                  {c.total} demandas
                  {c.atrasadas > 0 && <span className="text-danger"> · {c.atrasadas} atrasadas</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
