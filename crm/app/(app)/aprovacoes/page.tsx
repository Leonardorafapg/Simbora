import { getSession } from "@/services/server/auth";
import { hasPermission } from "@/lib/permissions";
import ApprovalsInboxClient from "@/components/approvals/ApprovalsInboxClient";

export default async function ApprovalsPage() {
  const session = await getSession();

  if (!hasPermission(session, "calendar.approve")) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-2 h-full py-24 px-6">
        <h1 className="text-xl font-semibold text-white">Sem acesso</h1>
        <p className="text-sm text-white/50 max-w-sm">Você não tem permissão para aprovar calendários.</p>
      </div>
    );
  }

  return <ApprovalsInboxClient />;
}
