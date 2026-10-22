import { getSession } from "@/services/server/auth";
import { hasPermission } from "@/lib/permissions";
import ProductionBoard from "@/components/production/ProductionBoard";

export default async function ProductionPage() {
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
    <ProductionBoard
      canEdit={hasPermission(session, "calendar.edit")}
      canCreate={hasPermission(session, "calendar.create")}
      canDelete={hasPermission(session, "calendar.delete")}
      canViewInstagram={hasPermission(session, "instagram.view")}
      canManageInstagram={hasPermission(session, "instagram.manage")}
    />
  );
}
