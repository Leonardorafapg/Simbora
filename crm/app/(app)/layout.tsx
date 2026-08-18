import { getSession } from "@/services/server/auth";
import AppShell from "@/components/layout/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return <AppShell user={session}>{children}</AppShell>;
}
