import DashboardSkeleton from "@/components/dashboard/DashboardSkeleton";
import PageHeader from "@/components/ui/PageHeader";

/** Mostrado pelo Next enquanto a página do dashboard carrega no servidor. */
export default function Loading() {
  return (
    <div className="h-full space-y-4 p-4 sm:p-8">
      <PageHeader title="Dashboard" description="Visão geral das entregas e das postagens do mês." className="mb-0" />
      <DashboardSkeleton />
    </div>
  );
}
