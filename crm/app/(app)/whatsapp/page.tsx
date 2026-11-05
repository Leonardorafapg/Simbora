import { getSession } from "@/services/server/auth";
import { hasPermission } from "@/lib/permissions";
import NoAccess from "@/components/ui/NoAccess";
import WhatsAppPageClient from "@/components/whatsapp/WhatsAppPageClient";

export default async function WhatsAppPage() {
  const session = await getSession();

  if (!hasPermission(session, "whatsapp.view")) {
    return <NoAccess message="Você não tem permissão para ver o WhatsApp." />;
  }

  return <WhatsAppPageClient />;
}
