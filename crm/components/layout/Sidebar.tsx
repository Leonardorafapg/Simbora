"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut, Moon, PanelLeftClose, PanelLeftOpen, Sun, X } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { logout } from "@/services/client/authApi";
import Avatar from "@/components/ui/Avatar";
import { useThemeToggle } from "@/components/layout/ThemeToggle";
import type { SessionUser } from "@/types/auth";

type Props = {
  user: SessionUser | null;
  mobileOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

// Rótulo curto do trilho recolhido (63px de largura).
const SHORT_LABEL: Record<string, string> = { "/settings": "Config." };

/**
 * Expandida (desktop): sidebar de 240px com ícone em bloco, item ativo
 * em destaque e a conta embaixo.
 * Recolhida (desktop): trilho fino de 63px — ícone em pílula com rótulo curto
 * embaixo e a conta como avatar (mesmo padrão do CRM+IA).
 * Abaixo de `lg` é um drawer, sempre no desenho expandido.
 */
export default function Sidebar({ user, mobileOpen, onClose, collapsed, onToggleCollapsed }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle: toggleTheme } = useThemeToggle();
  const [menuOpen, setMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const c = collapsed;

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
    router.refresh();
  }

  function renderItem(href: string) {
    const item = NAV_ITEMS.find((i) => i.href === href);
    if (!item) return null;
    const Icon = item.icon;
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const short = SHORT_LABEL[item.href] ?? item.label;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        title={item.label}
        aria-current={active ? "page" : undefined}
        className={`group flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors ${
          active
            ? c
              ? "text-accent max-lg:bg-accent-soft"
              : "bg-accent-soft text-accent"
            : c
              ? "text-text-muted hover:text-text max-lg:hover:bg-surface-2"
              : "text-text-muted hover:bg-surface-2 hover:text-text"
        } ${c ? "lg:flex-col lg:gap-[3px] lg:rounded-none lg:px-0 lg:py-1.5 lg:text-[9.25px]" : ""}`}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
            active ? "" : "group-hover:text-text"
          } ${c ? `lg:h-7 lg:w-[38px] lg:rounded-md ${active ? "lg:bg-accent-soft" : "lg:group-hover:bg-surface-2"}` : ""}`}
        >
          <Icon className={`h-[18px] w-[18px] shrink-0 ${c ? "lg:h-[17px] lg:w-[17px]" : ""}`} />
        </span>
        <span className={`min-w-0 flex-1 truncate ${c ? "lg:hidden" : ""}`}>{item.label}</span>
        {c && (
          <span className="hidden w-full truncate text-center leading-[12px] lg:block">{short}</span>
        )}
      </Link>
    );
  }

  return (
    <>
      {/* Backdrop — só existe no mobile, enquanto o drawer está aberto. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 transform flex-col border-r border-border bg-surface transition-[transform,width] duration-200 ease-out lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:shrink-0 lg:translate-x-0 ${
          c ? "lg:w-[63px]" : "lg:w-60"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Cabeçalho: logo + recolher/expandir */}
        <div
          className={`flex h-16 shrink-0 items-center justify-between border-b border-border px-4 ${
            c ? "lg:h-auto lg:flex-col lg:justify-start lg:gap-2 lg:px-0 lg:py-3" : ""
          }`}
        >
          <Image src="/logo.png" alt="Simbora" width={53} height={40} className="h-10 w-auto" priority />
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-text-muted hover:bg-surface-2 hover:text-text lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="hidden rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text lg:block"
            aria-label={c ? "Expandir menu" : "Recolher menu"}
            title={c ? "Expandir menu" : "Recolher menu"}
          >
            {c ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
          </button>
        </div>

        {/* Navegação */}
        <nav
          className={`flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-3 py-4 ${
            c ? "lg:gap-1.5 lg:px-0.5 lg:py-2.5" : ""
          }`}
        >
          {NAV_ITEMS.map((item) => renderItem(item.href))}
        </nav>

        {/* Conta */}
        <div
          ref={accountRef}
          className={`relative shrink-0 border-t border-border p-3 ${c ? "lg:flex lg:justify-center lg:px-0 lg:py-2.5" : ""}`}
        >
          {menuOpen && (
            <div
              role="menu"
              className={`absolute bottom-[calc(100%+6px)] left-3 right-3 z-50 rounded-xl border border-border bg-surface p-2 shadow-menu ${
                c ? "lg:bottom-2.5 lg:left-[calc(100%+6px)] lg:right-auto lg:w-[220px]" : ""
              }`}
            >
              {user && (
                <div className="px-2.5 pb-2.5 pt-2">
                  <p className="truncate text-[13px] font-semibold text-text">{user.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-text-muted">{user.email}</p>
                </div>
              )}
              <div className="my-0.5 h-px bg-border" />
              <button
                type="button"
                role="menuitem"
                onClick={toggleTheme}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2.5 text-left text-[13px] text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                {theme === "light" ? "Tema escuro" : "Tema claro"}
              </button>
              <div className="my-0.5 h-px bg-border" />
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2.5 text-left text-[13px] text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          )}

          {user ? (
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title={user.name}
              className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-surface-2 ${
                menuOpen ? "bg-surface-2" : ""
              } ${c ? "lg:w-auto lg:rounded-full lg:p-0.5" : ""}`}
            >
              <Avatar name={user.name} photoUrl={user.photo_url} size="sm" />
              <span className={`min-w-0 flex-1 ${c ? "lg:hidden" : ""}`}>
                <span className="block truncate text-[13px] font-semibold text-text">{user.name}</span>
                <span className="block truncate text-[11px] text-text-muted">{user.cargo}</span>
              </span>
              <ChevronsUpDown className={`h-4 w-4 shrink-0 text-text-faint ${c ? "lg:hidden" : ""}`} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-text-muted hover:bg-surface-2 hover:text-text"
            >
              <LogOut className="h-4 w-4" />
              <span className={c ? "lg:hidden" : ""}>Sair</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
