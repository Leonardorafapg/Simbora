"use client";

import type { SessionUser } from "@/types/auth";
import ProfileCard from "@/components/settings/ProfileCard";
import WhatsAppConnectionCard from "@/components/settings/WhatsAppConnectionCard";
import AiConnectionsCard from "@/components/settings/AiConnectionsCard";

type Props = {
  user: SessionUser | null;
};

export default function SettingsPageClient({ user }: Props) {
  return (
    <div className="p-4 sm:p-6 w-full flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-white">Configurações</h1>

      {user && <ProfileCard user={user} />}

      <WhatsAppConnectionCard />

      <AiConnectionsCard />
    </div>
  );
}
