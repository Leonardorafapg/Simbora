"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { logout } from "@/services/client/authApi";

type Props = {
  mobileOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

export default function Sidebar({ mobileOpen, onClose, collapsed, onToggleCollapsed }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      {/* Backdrop — só existe no mobile, enquanto o drawer está aberto. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-dark border-r border-white/10 flex flex-col transform transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:shrink-0 lg:translate-x-0 ${
          collapsed ? "lg:w-16" : "lg:w-52"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div
          className={`h-16 flex items-center justify-between border-b border-white/10 px-6 ${
            collapsed ? "lg:justify-center lg:px-0" : ""
          }`}
        >
          <Image
            src="/logo.png"
            alt="Simbora"
            width={53}
            height={40}
            className={`h-10 w-auto ${collapsed ? "lg:hidden" : ""}`}
            priority
          />
          <button
            type="button"
            onClick={onClose}
            className="text-white/50 hover:text-white lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="hidden text-white/50 hover:text-white lg:block"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  collapsed ? "lg:justify-center lg:px-0" : ""
                } ${
                  active
                    ? "bg-cyan/10 text-cyan"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10">
          <button
            type="button"
            onClick={handleLogout}
            title={collapsed ? "Sair" : undefined}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors ${
              collapsed ? "lg:justify-center lg:px-0" : ""
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={collapsed ? "lg:hidden" : ""}>Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}
