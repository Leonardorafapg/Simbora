import { getSession } from "@/services/server/auth";
import { hasPermission } from "@/lib/permissions";
import ProductionPageClient from "@/components/demands/ProductionPageClient";

export default async function ProductionPage() {
  const session = await getSession();

  return (
    <ProductionPageClient
      canCreate={hasPermission(session, "demand.create")}
      canEdit={hasPermission(session, "demand.edit")}
      canDelete={hasPermission(session, "demand.delete")}
    />
  );
}
