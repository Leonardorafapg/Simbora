import type { CSSProperties, ReactNode } from "react";
import { Info, TrendingDown, TrendingUp } from "lucide-react";

/** Moldura comum dos cards do dashboard: título + "i" (como o número é contado) + ação opcional à direita. */
export function DashCard({
  area,
  index = 0,
  title,
  info,
  action,
  children,
  className = "",
}: {
  area: string;
  /** Ordem de entrada: cada card aparece um pouco depois do anterior. */
  index?: number;
  title: string;
  info?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`animate-fade-up stagger flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-[var(--elev-card)] ${className}`}
      style={{ gridArea: area, "--i": index } as CSSProperties}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 className="truncate text-[13px] font-medium text-text-muted">{title}</h2>
          {info && (
            <span title={info} aria-label={info} className="shrink-0 cursor-help text-text-faint">
              <Info size={13} />
            </span>
          )}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Selo de variação. `goodWhen`: "down" quando cair é bom (ex.: atrasos), "up" no resto. */
export function Delta({
  value,
  goodWhen = "up",
  suffix,
}: {
  value: number | null | undefined;
  goodWhen?: "up" | "down";
  suffix?: string;
}) {
  if (value == null || !isFinite(value)) return null;
  const good = goodWhen === "up" ? value >= 0 : value <= 0;
  const Icon = value >= 0 ? TrendingUp : TrendingDown;
  const pct = Math.abs(value * 100);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        good ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
      }`}
    >
      <Icon size={12} />
      {pct >= 10 ? Math.round(pct) : pct.toFixed(1).replace(".", ",")}%{suffix ? ` ${suffix}` : ""}
    </span>
  );
}

export function BigNumber({ children, sub, tone }: { children: ReactNode; sub?: ReactNode; tone?: "danger" | "warn" | "ok" }) {
  const color = tone === "danger" ? "text-danger" : tone === "warn" ? "text-amber-400" : tone === "ok" ? "text-emerald-400" : "text-text";
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className={`flex flex-wrap items-center gap-2 text-[26px] font-semibold leading-tight tracking-[-0.02em] ${color}`}>
        {children}
      </div>
      {sub && <p className="text-[12px] text-text-muted">{sub}</p>}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5 text-[12px] text-text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
