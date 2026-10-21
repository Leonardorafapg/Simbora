"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useCalendarEntries } from "@/hooks/useCalendarEntries";
import { useClients } from "@/hooks/useClients";
import { useTeamDirectory } from "@/hooks/useTeamDirectory";
import { MONTH_LABELS, CALENDAR_ENTRY_STATUSES, CALENDAR_ENTRY_STATUS_LABELS } from "@/types/calendar";
import { deadlineInfo } from "@/lib/deadline";
import { todayLocalISO } from "@/lib/format";
import { BigNumber, DashCard, Delta, Legend } from "./DashCard";
import { CalendarHeatmap, COR_ACCENT, COR_NEUTRA, Donut, HBars, StackedBars, tom } from "./charts";

function monthOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  return monthOf(new Date(y, m - 1 + delta, 1));
}

const SERIES = [
  { key: "producao", label: "Produção", color: COR_NEUTRA },
  { key: "aprovacao", label: "Em aprovação / modificações", color: tom(50) },
  { key: "aprovados", label: "Aprovados", color: COR_ACCENT },
  { key: "publicados", label: "Publicados", color: "#34d399" },
];

function groupOf(status: string) {
  if (status === "publicados") return "publicados";
  if (status === "finalizados") return "aprovados";
  if (status === "checagem_aprovacao" || status === "modificacoes") return "aprovacao";
  return "producao";
}

/** Visão geral das postagens de um mês, de todos os clientes. */
export default function PostsDashboard() {
  const [month, setMonth] = useState(() => monthOf(new Date()));
  const { entries, loading, error } = useCalendarEntries(undefined, month);
  const { entries: previous } = useCalendarEntries(undefined, shiftMonth(month, -1));
  const { clients } = useClients();
  const { members } = useTeamDirectory();

  const [year, monthNumber] = month.split("-").map(Number);

  const stats = useMemo(() => {
    const today = todayLocalISO();
    const infos = entries.map((entry) => ({ entry, info: deadlineInfo(entry, today) }));
    const count = (state: string) => infos.filter((i) => i.info.state === state).length;

    const noPrazo = count("entregue_no_prazo");
    const comAtraso = count("entregue_atrasado");
    const entregues = noPrazo + comAtraso;
    const atrasadas = count("atrasado");
    const vencendo = count("vence_hoje") + count("vence_amanha");

    const diasNoMes = new Date(year, monthNumber, 0).getDate();
    const faixas: [number, number][] = [
      [1, 7],
      [8, 14],
      [15, 21],
      [22, 28],
    ];
    if (diasNoMes >= 29) faixas.push([29, diasNoMes]);
    const semanas = faixas.map(([ini, fim]) => {
      const linha: { label: string } & Record<string, number | string> = {
        label: ini === fim ? `${ini}` : `${ini}–${fim}`,
        producao: 0,
        aprovacao: 0,
        aprovados: 0,
        publicados: 0,
      };
      for (const e of entries) {
        const dia = Number(e.scheduled_date.slice(8, 10));
        if (dia >= ini && dia <= fim) linha[groupOf(e.status)] = Number(linha[groupOf(e.status)]) + 1;
      }
      return linha;
    });

    const porDia = new Map<number, number>();
    for (const e of entries) {
      const dia = Number(e.scheduled_date.slice(8, 10));
      porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
    }
    const dias = Array.from({ length: diasNoMes }, (_, i) => ({ dia: i + 1, value: porDia.get(i + 1) ?? 0 }));
    const hoje = today.startsWith(month) ? Number(today.slice(8, 10)) : null;

    const top = (keyOf: (e: (typeof entries)[number]) => string) => {
      const map = new Map<string, number>();
      for (const e of entries) map.set(keyOf(e), (map.get(keyOf(e)) ?? 0) + 1);
      return [...map.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
    };

    return {
      total: entries.length,
      noPrazo,
      entregues,
      pctNoPrazo: entregues ? noPrazo / entregues : null,
      atrasadas,
      vencendo,
      semanas,
      dias,
      diasMax: Math.max(0, ...dias.map((d) => d.value)),
      primeiroDia: new Date(year, monthNumber - 1, 1).getDay(),
      hoje,
      porResponsavel: top((e) => members.find((m) => m.id === e.assignee_id)?.full_name ?? "Sem responsável"),
      porCliente: top((e) => clients.find((c) => c.id === e.client_id)?.name ?? "Sem cliente"),
      porStatus: CALENDAR_ENTRY_STATUSES.map((status) => ({
        label: CALENDAR_ENTRY_STATUS_LABELS[status],
        value: entries.filter((e) => e.status === status).length,
      })),
    };
  }, [entries, clients, members, month, year, monthNumber]);

  const delta = previous.length ? (stats.total - previous.length) / previous.length : null;
  const monthLabel = `${MONTH_LABELS[monthNumber - 1]} de ${year}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month, -1))}
          aria-label="Mês anterior"
          className="rounded-md border border-border p-1.5 text-text-muted transition-colors hover:bg-surface-2"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="min-w-[150px] text-center text-[13px] font-medium text-text">{monthLabel}</span>
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month, 1))}
          aria-label="Próximo mês"
          className="rounded-md border border-border p-1.5 text-text-muted transition-colors hover:bg-surface-2"
        >
          <ChevronRight size={14} />
        </button>
        {loading && <span className="text-xs text-text-faint">Carregando...</span>}
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>

      <div className="dash-grid">
        <DashCard
          area="kpi1"
          title="Entregues no prazo"
          info="Das postagens do mês que já foram entregues (em aprovação, modificações, aprovadas ou publicadas), quantas chegaram até a quinta-feira da semana anterior à data do post."
        >
          <div className="flex items-center gap-4">
            <Donut fracao={stats.pctNoPrazo} />
            <BigNumber sub="entregas do mês">
              {stats.noPrazo}
              <span className="text-[18px] font-normal text-text-faint">/{stats.entregues}</span>
            </BigNumber>
          </div>
        </DashCard>

        <DashCard
          area="kpi2"
          title="Entregas atrasadas"
          info="Postagens que passaram do prazo de entrega e ainda estão em produção."
        >
          <BigNumber
            tone={stats.atrasadas > 0 ? "danger" : "ok"}
            sub={
              <>
                vencem hoje ou amanhã: <b className="font-medium text-text">{stats.vencendo}</b>
              </>
            }
          >
            {stats.atrasadas}
          </BigNumber>
        </DashCard>

        <DashCard area="cal" title="Calendário de postagens" info="Quantidade de postagens por dia de publicação.">
          <BigNumber sub={<span>{monthLabel}</span>}>{stats.total} postagens</BigNumber>
          <CalendarHeatmap dias={stats.dias} offset={stats.primeiroDia} max={stats.diasMax} hoje={stats.hoje} />
        </DashCard>

        <DashCard area="main" title="Postagens por semana" info="Postagens do mês por faixa de dias, separadas por etapa.">
          <BigNumber sub="no mês">
            {stats.total}
            <Delta value={delta} suffix="vs mês anterior" />
          </BigNumber>
          <Legend items={SERIES.map(({ label, color }) => ({ label, color }))} />
          <StackedBars data={stats.semanas} series={SERIES} ariaLabel="Postagens por semana" />
        </DashCard>

        <DashCard area="dest" title="Por responsável" info="Postagens do mês por responsável (as 6 maiores cargas).">
          <HBars data={stats.porResponsavel} emptyText="Nenhuma postagem neste mês." />
        </DashCard>

        <DashCard area="linha" title="Por cliente" info="Postagens do mês por cliente (os 6 com mais postagens).">
          <HBars data={stats.porCliente} emptyText="Nenhuma postagem neste mês." />
        </DashCard>

        <DashCard area="barras" title="Por etapa" info="Quantas postagens do mês estão em cada etapa da Produção.">
          <HBars data={stats.porStatus} />
        </DashCard>

        <DashCard area="link" title="Produção">
          <Link
            href="/production"
            className="group flex flex-1 items-center justify-between gap-3 rounded-lg bg-accent-soft px-4 py-3 text-[13px] font-medium text-accent transition-colors hover:bg-accent-soft/70"
          >
            Abrir o quadro de Produção
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </DashCard>
      </div>
    </div>
  );
}
