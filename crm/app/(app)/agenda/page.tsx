import { getSession } from "@/services/server/auth";
import { hasPermission } from "@/lib/permissions";
import AgendaPageClient from "@/components/agenda/AgendaPageClient";

export default async function AgendaPage() {
  const session = await getSession();
  return <AgendaPageClient currentUserId={session ? Number(session.sub) : null} canEditOthers={hasPermission(session, "agenda.edit")} />;
}
