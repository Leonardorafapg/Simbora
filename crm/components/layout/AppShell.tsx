"use client";

import { useState } from "react";
import type { SessionUser } from "@/types/auth";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

type Props = {
  user: SessionUser | null;
  children: React.ReactNode;
};

/**
 * Dona do estado do menu mobile — precisa ser client porque Sidebar/Topbar
 * são renderizados de um layout Server Component (`app/(app)/layout.tsx`),
 * então o toggle do hambúrguer não pode viver em nenhum dos dois sozinho.
 */
export default function AppShell({ user, children }: Props) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar user={user} onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 relative min-w-0">{children}</main>
      </div>
    </div>
  );
}
