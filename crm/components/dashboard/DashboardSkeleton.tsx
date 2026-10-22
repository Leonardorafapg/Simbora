import Skeleton from "@/components/ui/Skeleton";

function Card({ area, className = "", children }: { area: string; className?: string; children: React.ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className={`flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-[var(--elev-card)] ${className}`}
      style={{ gridArea: area }}
    >
      {children}
    </div>
  );
}

/** Esqueleto animado do dashboard (mesma grade da tela real). */
export default function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Carregando o dashboard" className="dash-grid">
      <Card area="kpi1">
        <Skeleton className="h-3 w-32" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-[92px] w-[92px] !rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </Card>
      <Card area="kpi2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-14" />
        <Skeleton className="h-3 w-40" />
      </Card>
      <Card area="cal">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-7 w-32" />
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 35 }, (_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      </Card>
      <Card area="main">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-16" />
        <div className="flex flex-1 items-end gap-6 pt-6" style={{ minHeight: 230 }}>
          {[40, 70, 55, 90, 35].map((h, i) => (
            <Skeleton key={i} className="flex-1" />
          ))}
        </div>
      </Card>
      <Card area="dest">
        <Skeleton className="h-3 w-28" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </Card>
      <Card area="linha">
        <Skeleton className="h-3 w-24" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </Card>
      <Card area="barras">
        <Skeleton className="h-3 w-24" />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </Card>
      <Card area="link">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-12 w-full" />
      </Card>
    </div>
  );
}
