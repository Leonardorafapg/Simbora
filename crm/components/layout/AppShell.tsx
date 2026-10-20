"use client";

import { useEffect, useState } from "react";
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
  const [collapsed, setCollapsed] = useState(false);

  // Lê a preferência só depois de montar, para não divergir do HTML do servidor.
  useEffect(() => {
    try {
      if (localStorage.getItem("sidebar-collapsed") === "1") setCollapsed(true);
    } catch {}
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar
        user={user}
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <Topbar user={user} onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 relative min-w-0 min-h-0 overflow-auto flex flex-col">{children}</main>
      </div>
    </div>
  );
}
