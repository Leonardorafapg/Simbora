import { getSession } from "@/services/server/auth";
import { canManageTeam } from "@/lib/permissions";
import TeamPageClient from "@/components/team/TeamPageClient";

export default async function TeamPage() {
  const session = await getSession();

  return <TeamPageClient canManage={canManageTeam(session?.is_admin)} />;
}
