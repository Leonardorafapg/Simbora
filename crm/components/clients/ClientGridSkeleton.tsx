import Skeleton from "@/components/ui/Skeleton";

/** Esqueleto animado da grade de clientes. */
export default function ClientGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div role="status" aria-label="Carregando clientes" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} aria-hidden="true" className="glass-card flex flex-col gap-3 rounded-2xl p-5">
          <Skeleton className="h-12 w-12 !rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
