import { redirect } from "next/navigation";
import { getSession } from "@/services/server/auth";
import { canManageTeam } from "@/lib/permissions";
import TeamPageClient from "@/components/team/TeamPageClient";

export default async function TeamPage() {
  const session = await getSession();

  // Checado aqui (e não no proxy) porque só a sessão relida do backend sabe se
  // o usuário ainda é admin; o JWT do proxy pode estar desatualizado.
  if (!canManageTeam(session?.is_admin)) {
    redirect("/dashboard");
  }

  return <TeamPageClient canManage currentUserId={session ? Number(session.sub) : null} />;
}
