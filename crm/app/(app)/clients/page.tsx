import { getSession } from "@/services/server/auth";
import { hasPermission } from "@/lib/permissions";
import NoAccess from "@/components/ui/NoAccess";
import ClientPageClient from "@/components/clients/ClientPageClient";

export default async function ClientsPage() {
  const session = await getSession();

  if (!hasPermission(session, "client.view")) {
    return <NoAccess message="Você não tem permissão para ver os clientes." />;
  }

  return (
    <ClientPageClient
      canCreate={hasPermission(session, "client.create")}
      canEdit={hasPermission(session, "client.edit")}
      canDelete={hasPermission(session, "client.delete")}
      calendarPermissions={{
        canCreate: hasPermission(session, "calendar.create"),
        canEdit: hasPermission(session, "calendar.edit"),
        canDelete: hasPermission(session, "calendar.delete"),
        canApprove: hasPermission(session, "calendar.approve"),
      }}
      instagramPermissions={{
        canView: hasPermission(session, "instagram.view"),
        canManage: hasPermission(session, "instagram.manage"),
      }}
    />
  );
}
