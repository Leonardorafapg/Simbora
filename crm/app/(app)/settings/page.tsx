import { getSession } from "@/services/server/auth";
import SettingsPageClient from "@/components/settings/SettingsPageClient";

export default async function SettingsPage() {
  const session = await getSession();

  return <SettingsPageClient user={session} />;
}
