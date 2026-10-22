"use client";

// Gráficos do dashboard em SVG/CSS puro (sem biblioteca): as cores vêm dos
// tokens do tema (--accent, --surface-2, --text-faint...), então funcionam no
// tema claro e no escuro.

import { useEffect, useId, useState } from "react";
import { useCountUp } from "@/components/ui/CountUp";

/** Tom da cor de destaque (--accent) com `pct`% de opacidade. */
export const tom = (pct: number) => `color-mix(in srgb, var(--accent) ${pct}%, transparent)`;
export const COR_ACCENT = "var(--accent)";
export const COR_NEUTRA = "var(--text-faint)";
const COR_TRILHO = "var(--surface-2)";

/** Marcas do eixo: inteiros de 1 em 1 quando o máximo é pequeno, senão em quartos. */
function eixoTicks(max: number): number[] {
  return max <= 5 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, max / 4, max / 2, (3 * max) / 4, max];
}

function niceMax(v: number): number {
  if (v <= 5) return 5;
  const pot = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pot;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pot;
}

/** Mede a caixa onde o gráfico vive: largura real (mínimo `minWidth`) e altura até o fim do card. */
function useCaixa(larguraInicial: number, minHeight: number, minWidth = 240) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [dim, setDim] = useState({ w: larguraInicial, h: minHeight });
  useEffect(() => {
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      setDim({ w: Math.max(minWidth, Math.round(r.width)), h: Math.round(r.height) });
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, minWidth]);
  return { setEl, width: dim.w, height: Math.max(minHeight, dim.h) };
}

// ── rosca ────────────────────────────────────────────────────────────────────
export function Donut({
  fracao,
  size = 92,
  stroke = 11,
  color = COR_ACCENT,
}: {
  fracao: number | null;
  size?: number;
  stroke?: number;
  color?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fracao ?? 0));
  // O arco cresce de 0 até o valor enquanto a rosca dá uma volta (e o número sobe junto).
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const pct = useCountUp(f * 100, 1100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label={`${Math.round(f * 100)}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COR_TRILHO} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${armed ? c * f : 0} ${c}`}
        style={{
          transformOrigin: "50% 50%",
          transform: `rotate(${armed ? -90 : -270}deg)`,
          transition: "stroke-dasharray 1.1s cubic-bezier(0.22, 1, 0.36, 1), transform 1.1s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-text text-[15px] font-semibold">
        {fracao == null ? "—" : `${Math.round(pct)}%`}
      </text>
    </svg>
  );
}

// ── linha de tendência (KPI) ─────────────────────────────────────────────────
export function Sparkline({ valores, height: minHeight = 56 }: { valores: (number | null)[]; height?: number }) {
  const { setEl, width, height } = useCaixa(150, minHeight, 0);
  const pontos = valores.map((v, i) => ({ i, v })).filter((p): p is { i: number; v: number } => p.v != null);
  const caixa = (filho: React.ReactNode) => (
    <div ref={setEl} className="relative min-w-[120px] flex-1 self-stretch overflow-hidden" style={{ minHeight }}>
      {filho}
    </div>
  );
  if (pontos.length < 2) {
    return caixa(<div className="absolute inset-0 flex items-center justify-center text-[11px] text-text-faint">sem dados</div>);
  }
  const max = Math.max(...pontos.map((p) => p.v));
  const min = Math.min(...pontos.map((p) => p.v));
  const x = (i: number) => (i / Math.max(1, valores.length - 1)) * (width - 4) + 2;
  const y = (v: number) => height - 4 - ((v - min) / (max - min || 1)) * (height - 8);
  const d = pontos.map((p, k) => `${k ? "L" : "M"}${x(p.i)},${y(p.v)}`).join(" ");
  const area = `${d} L${x(pontos[pontos.length - 1].i)},${height} L${x(pontos[0].i)},${height} Z`;
  return caixa(
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 block" aria-hidden>
      {pontos.map((p) => (
        <line key={p.i} x1={x(p.i)} x2={x(p.i)} y1={y(p.v)} y2={height} stroke="var(--border)" strokeDasharray="2 3" />
      ))}
      <path d={area} fill={tom(10)} />
      <path d={d} fill="none" stroke={COR_ACCENT} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>,
  );
}

// ── barras empilhadas ────────────────────────────────────────────────────────
export type Serie = { key: string; label: string; color: string };

export function StackedBars({
  data,
  series,
  height: minHeight = 230,
  ariaLabel = "Gráfico de barras",
}: {
  data: Array<{ label: string } & Record<string, number | string>>;
  series: Serie[];
  height?: number; // altura mínima: o gráfico cresce até o fim do card
  ariaLabel?: string;
}) {
  const { setEl, width, height } = useCaixa(640, minHeight);
  const gid = useId().replace(/:/g, "");
  const padL = 34;
  const padB = 26;
  const padT = 8;
  const totais = data.map((d) => series.reduce((a, s) => a + Number(d[s.key] || 0), 0));
  const max = niceMax(Math.max(1, ...totais));
  const h = height - padB - padT;
  const passo = (width - padL) / Math.max(1, data.length);
  const larg = Math.min(34, passo * 0.55);
  const ticks = eixoTicks(max);
  return (
    <div ref={setEl} className="relative w-full min-w-0 flex-1" style={{ minHeight }}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={ariaLabel} className="absolute inset-0 block">
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`bar-${gid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: s.color }} stopOpacity="1" />
              <stop offset="1" style={{ stopColor: s.color }} stopOpacity="0.55" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t) => {
          const y = padT + h - (t / max) * h;
          return (
            <g key={t}>
              <line x1={padL} x2={width} y1={y} y2={y} stroke="var(--border)" strokeDasharray="3 4" />
              <text x={padL - 8} y={y} dominantBaseline="central" textAnchor="end" className="fill-text-faint text-[11px]">
                {Math.round(t)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          let topo = padT + h;
          const cx = padL + passo * i + passo / 2;
          return (
            <g key={d.label}>
              <title>{`${d.label}: ${series.map((s) => `${s.label} ${d[s.key] || 0}`).join(" · ")}`}</title>
              {series.map((s, si) => {
                const v = Number(d[s.key] || 0);
                const bh = (v / max) * h;
                topo -= bh;
                const ultima = series.slice(si + 1).every((s2) => !Number(d[s2.key] || 0));
                return v > 0 ? (
                  <rect key={s.key} className="grow-y transition-opacity hover:opacity-75" style={{ animationDelay: `${i * 90 + si * 40}ms` }} x={cx - larg / 2} y={topo} width={larg} height={bh} rx={ultima ? 4 : 0} fill={`url(#bar-${gid}-${s.key})`} />
                ) : null;
              })}
              <text x={cx} y={height - 8} textAnchor="middle" className="fill-text-muted text-[11px]">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── linha com área ───────────────────────────────────────────────────────────
export function AreaLine({
  data,
  height: minHeight = 150,
  format,
  ariaLabel = "Gráfico de linha",
}: {
  data: { label: string; value: number }[];
  height?: number;
  format?: (v: number) => string;
  ariaLabel?: string;
}) {
  const { setEl, width, height } = useCaixa(420, minHeight);
  const gid = useId().replace(/:/g, "");
  const padB = 22;
  const padT = 10;
  if (!data.length) return null;
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const h = height - padB - padT;
  const x = (i: number) => (i / Math.max(1, data.length - 1)) * (width - 16) + 8;
  const y = (v: number) => padT + h - (v / max) * h;
  const d = data.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  const area = `${d} L${x(data.length - 1)},${padT + h} L${x(0)},${padT + h} Z`;
  const cada = Math.ceil(data.length / 6);
  return (
    <div ref={setEl} className="relative w-full min-w-0 flex-1" style={{ minHeight }}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={ariaLabel} className="absolute inset-0 block">
        {data.map((p, i) => (
          <g key={p.label}>
            <line x1={x(i)} x2={x(i)} y1={padT} y2={padT + h} stroke="var(--border)" strokeDasharray="2 4" />
            {(i % cada === 0 || i === data.length - 1) && (
              <text x={x(i)} y={height - 6} textAnchor="middle" className="fill-text-muted text-[10px]">
                {p.label}
              </text>
            )}
            <title>{`${p.label}: ${format ? format(p.value) : p.value}`}</title>
          </g>
        ))}
        <defs>
          <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--accent)" }} stopOpacity="0.35" />
            <stop offset="1" style={{ stopColor: "var(--accent)" }} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#area-${gid})`} />
        <path d={d} fill="none" stroke={COR_ACCENT} strokeWidth={2} strokeLinejoin="round" />
        <circle cx={x(data.length - 1)} cy={y(data[data.length - 1].value)} r={3.5} fill={COR_ACCENT} />
      </svg>
    </div>
  );
}

// ── barras horizontais ───────────────────────────────────────────────────────
export function HBars({ data, emptyText = "Sem dados no período." }: { data: { label: string; value: number }[]; emptyText?: string }) {
  if (data.length === 0) return <p className="text-xs text-text-faint">{emptyText}</p>;
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const ticks = eixoTicks(max);
  return (
    <div className="flex flex-col gap-3">
      {data.map((d, index) => (
        <div key={d.label} className="grid grid-cols-[140px_1fr_36px] items-center gap-2">
          <span className="truncate text-[12px] text-text-muted" title={d.label}>
            {d.label}
          </span>
          <div className="h-3 overflow-hidden rounded-[3px] sm:h-4" style={{ background: COR_TRILHO }}>
            <div className="grow-x h-full rounded-[3px]" style={{ width: `${(d.value / max) * 100}%`, background: COR_ACCENT, animationDelay: `${index * 80}ms` }} />
          </div>
          <span className="text-right text-[12px] font-medium text-text">{d.value}</span>
        </div>
      ))}
      <div className="grid grid-cols-[140px_1fr_36px] gap-2">
        <span />
        <div className="flex justify-between text-[10px] text-text-faint">
          {ticks.map((t) => (
            <span key={t}>{Math.round(t)}</span>
          ))}
        </div>
        <span />
      </div>
    </div>
  );
}

// ── calendário do mês (heatmap) ──────────────────────────────────────────────
const NIVEIS = [0, 22, 45, 72, 100];

export function CalendarHeatmap({
  dias,
  offset,
  max,
  hoje,
  itemLabel = ["postagem", "postagens"],
}: {
  dias: { dia: number; value: number }[];
  /** Quantas células vazias antes do dia 1 (dia da semana do dia 1, domingo = 0). */
  offset: number;
  max: number;
  hoje: number | null;
  itemLabel?: [string, string];
}) {
  const nivel = (v: number) => (v <= 0 ? 0 : Math.min(4, Math.ceil((v / Math.max(1, max)) * 4)));
  const celulas: ({ dia: number; value: number } | null)[] = [...Array(offset).fill(null), ...dias];
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-1.5">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((l, i) => (
          <span key={i} className="text-center text-[11px] text-text-faint">
            {l}
          </span>
        ))}
        {celulas.map((c, i) =>
          c === null ? (
            <span key={`v${i}`} />
          ) : (
            <div
              key={c.dia}
              title={`Dia ${c.dia}: ${c.value} ${c.value === 1 ? itemLabel[0] : itemLabel[1]}`}
              className={`pop-in flex aspect-square items-center justify-center rounded-[5px] text-[10px] ${
                hoje === c.dia ? "ring-2 ring-accent ring-offset-1 ring-offset-[var(--surface)]" : ""
              }`}
              style={{
                animationDelay: `${i * 18}ms`,
                background: nivel(c.value) ? tom(NIVEIS[nivel(c.value)]) : COR_TRILHO,
                color: nivel(c.value) >= 3 ? "#fff" : "var(--text-faint)",
              }}
            >
              {c.dia}
            </div>
          ),
        )}
      </div>
      <div className="flex items-center justify-end gap-1 text-[10px] text-text-faint">
        Menos
        {NIVEIS.map((n, i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: n ? tom(n) : COR_TRILHO }} />
        ))}
        Mais
      </div>
    </div>
  );
}
