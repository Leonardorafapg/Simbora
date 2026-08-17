import { getSession } from "@/services/server/auth";
import { hasPermission } from "@/lib/permissions";
import ClientPageClient from "@/components/clients/ClientPageClient";

export default async function ClientsPage() {
  const session = await getSession();

  return (
    <ClientPageClient
      canCreate={hasPermission(session, "client.create")}
      canEdit={hasPermission(session, "client.edit")}
      canDelete={hasPermission(session, "client.delete")}
      calendarPermissions={{
        canCreate: hasPermission(session, "calendar.create"),
        canEdit: hasPermission(session, "calendar.edit"),
        canDelete: hasPermission(session, "calendar.delete"),
      }}
    />
  );
}
