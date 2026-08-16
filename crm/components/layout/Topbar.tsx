import { Search } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import ThemeToggle from "@/components/layout/ThemeToggle";
import type { SessionUser } from "@/types/auth";

type Props = {
  user: SessionUser | null;
};

export default function Topbar({ user }: Props) {
  return (
    <header className="h-16 shrink-0 border-b border-white/10 flex items-center justify-between gap-4 px-6">
      <label className="relative flex-1 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
        <input
          type="search"
          placeholder="Buscar..."
          className="glass-input w-full rounded-lg pl-9 pr-3 py-2 text-sm outline-none"
        />
      </label>

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
