import { getSession } from "@/services/server/auth";
import { hasPermission } from "@/lib/permissions";
import PostsDashboard from "@/components/dashboard/PostsDashboard";
import PageHeader from "@/components/ui/PageHeader";

export default async function DashboardPage() {
  const session = await getSession();

  if (!hasPermission(session, "calendar.view")) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-2 h-full py-24 px-6">
        <h1 className="text-xl font-semibold text-text">Sem acesso</h1>
        <p className="text-sm text-text-muted max-w-sm">Você não tem permissão para ver o calendário.</p>
      </div>
    );
  }

  return (
    <div className="h-full p-4 sm:p-8 space-y-4">
      <PageHeader title="Dashboard" description="Visão geral das entregas e das postagens do mês." className="mb-0" />
      <PostsDashboard />
    </div>
  );
}
