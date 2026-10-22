"use client";

import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { canManageTeam } from "@/lib/permissions";
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
      <h1 className="text-lg font-semibold text-text">Configurações</h1>

      {user && <ProfileCard user={user} />}

      {canManageTeam(user?.is_admin) && (
        <Link
          href="/team"
          className="glass-card flex items-center gap-4 rounded-2xl p-5 transition-colors hover:border-border-hover"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Users className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-text">Equipe</span>
            <span className="block text-xs text-text-muted">Membros, cargos e permissões de acesso.</span>
          </span>
          <ChevronRight className="h-4 w-4 text-text-faint" />
        </Link>
      )}

      <WhatsAppConnectionCard />

      <AiConnectionsCard />
    </div>
  );
}
