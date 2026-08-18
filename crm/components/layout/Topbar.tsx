import { Menu } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import ThemeToggle from "@/components/layout/ThemeToggle";
import GlobalSearch from "@/components/layout/GlobalSearch";
import type { SessionUser } from "@/types/auth";

type Props = {
  user: SessionUser | null;
  onMenuClick: () => void;
};

export default function Topbar({ user, onMenuClick }: Props) {
  return (
    <header className="h-16 shrink-0 border-b border-white/10 flex items-center justify-between gap-3 px-4 sm:px-6">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={onMenuClick}
          className="text-white/60 hover:text-white lg:hidden shrink-0"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <ThemeToggle />

        {user && (
          <div className="flex items-center gap-3 pl-3 border-l border-white/10">
            <span className="text-sm text-white/80 hidden sm:block">{user.name}</span>
            <Avatar name={user.name} photoUrl={user.photo_url} size="sm" />
          </div>
        )}
      </div>
    </header>
  );
}
