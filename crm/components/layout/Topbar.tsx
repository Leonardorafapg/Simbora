"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Settings } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import ThemeToggle from "@/components/layout/ThemeToggle";
import GlobalSearch from "@/components/layout/GlobalSearch";
import { OPEN_PALETTE_EVENT } from "@/components/layout/CommandPalette";
import type { SessionUser } from "@/types/auth";

type Props = {
  user: SessionUser | null;
  onMenuClick: () => void;
};

export default function Topbar({ user, onMenuClick }: Props) {
  const pathname = usePathname();
  const settingsActive = pathname.startsWith("/settings") || pathname.startsWith("/team");
  return (
    <header className="h-16 shrink-0 border-b border-border flex items-center justify-between gap-3 px-4 sm:px-6">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={onMenuClick}
          className="text-text-muted hover:text-text lg:hidden shrink-0"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
          title="Paleta de comandos"
          className="hidden items-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-xs text-text-muted transition-colors hover:border-cyan/40 hover:text-text md:flex"
        >
          <kbd className="font-sans">Ctrl</kbd>
          <kbd className="font-sans">K</kbd>
        </button>
        <ThemeToggle />
        <Link
          href="/settings"
          aria-label="Configurações"
          title="Configurações"
          aria-current={settingsActive ? "page" : undefined}
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-surface-2 ${
            settingsActive ? "bg-accent-soft text-accent" : "text-text-muted hover:text-text"
          }`}
        >
          <Settings className="h-4 w-4" />
        </Link>

        {user && (
          <div className="flex items-center gap-3 pl-3 border-l border-border">
            <span className="text-sm text-text hidden sm:block">{user.name}</span>
            <Avatar name={user.name} photoUrl={user.photo_url} size="sm" />
          </div>
        )}
      </div>
    </header>
  );
}
