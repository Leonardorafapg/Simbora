"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, CalendarDays, CornerDownLeft, LogOut, Rows3, Search, User as UserIcon } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { logout } from "@/services/client/authApi";
import { fetchSearchResults } from "@/services/client/searchApi";
import { NEXT_THEME_LABEL, ThemeIcon, useDensity, useThemeToggle } from "@/components/layout/ThemeToggle";
import type { SearchResult } from "@/types/search";

export const OPEN_PALETTE_EVENT = "open-command-palette";

type Item = { id: string; label: string; hint?: string; group: string; icon: React.ReactNode; run: () => void };

function resultHref(result: SearchResult): string {
  switch (result.type) {
    case "client":
      return `/clients?openClient=${result.id}`;
    case "calendar_entry":
      return `/clients?openClient=${result.client_id}`;
    case "user":
      return `/team?openMember=${result.id}`;
  }
}

const RESULT_ICON = { client: Briefcase, calendar_entry: CalendarDays, user: UserIcon } as const;

/** Paleta de comandos (Ctrl/⌘ + K): navegação, ações rápidas e busca de clientes, postagens e equipe. */
export default function CommandPalette() {
  const router = useRouter();
  const { theme, toggle: toggleTheme } = useThemeToggle();
  const { density, toggleDensity } = useDensity();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActive(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Busca remota (com debounce) só a partir de 2 caracteres.
  useEffect(() => {
    const term = query.trim();
    if (!open || term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setResults(await fetchSearchResults(term, controller.signal));
      } catch {
        // busca abortada por um termo novo
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  const items = useMemo<Item[]>(() => {
    const go = (href: string) => () => {
      close();
      router.push(href);
    };
    const pages: Item[] = NAV_ITEMS.map((n) => {
      const Icon = n.icon;
      return { id: `nav-${n.href}`, label: n.label, group: "Ir para", icon: <Icon className="h-4 w-4" />, run: go(n.href) };
    });
    const actions: Item[] = [
      {
        id: "act-theme",
        label: `Mudar para ${NEXT_THEME_LABEL[theme ?? "dark"].toLowerCase()}`,
        group: "Ações",
        icon: <ThemeIcon theme={theme} />,
        run: () => {
          close();
          toggleTheme();
        },
      },
      {
        id: "act-density",
        label: density === "compact" ? "Densidade confortável" : "Densidade compacta",
        group: "Ações",
        icon: <Rows3 className="h-4 w-4" />,
        run: () => {
          close();
          toggleDensity();
        },
      },
      {
        id: "act-logout",
        label: "Sair",
        group: "Ações",
        icon: <LogOut className="h-4 w-4" />,
        run: async () => {
          close();
          await logout();
          router.replace("/login");
          router.refresh();
        },
      },
    ];
    const term = query.trim().toLowerCase();
    const filter = (list: Item[]) => (term ? list.filter((i) => i.label.toLowerCase().includes(term)) : list);
    const found: Item[] =
      query.trim().length >= 2
        ? results.map((r) => {
            const Icon = RESULT_ICON[r.type];
            return {
              id: `res-${r.type}-${r.id}`,
              label: r.title,
              hint: r.subtitle ?? undefined,
              group: r.type === "client" ? "Clientes" : r.type === "user" ? "Equipe" : "Postagens",
              icon: <Icon className="h-4 w-4" />,
              run: go(resultHref(r)),
            };
          })
        : [];
    return [...filter(pages), ...filter(actions), ...found];
  }, [query, results, theme, density, router, close, toggleTheme, toggleDensity]);

  if (!open) return null;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[active]?.run();
    }
  }

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 px-4 pt-[15vh] backdrop-blur-sm" onMouseDown={close}>
      <div
        role="dialog"
        aria-label="Paleta de comandos"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="animate-fade-up w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface shadow-menu ring-1 ring-accent/20"
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Buscar clientes, postagens, equipe ou ir para…"
            className="h-12 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-faint"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-text-faint">Esc</kbd>
        </div>

        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-text-faint">Nada encontrado.</li>}
          {items.map((item, index) => {
            const showGroup = item.group !== lastGroup;
            lastGroup = item.group;
            return (
              <li key={item.id}>
                {showGroup && (
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-text-faint">{item.group}</p>
                )}
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={item.run}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    index === active ? "bg-accent-soft text-accent" : "text-text"
                  }`}
                >
                  <span className="text-text-muted">{item.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="truncate text-xs text-text-faint">{item.hint}</span>}
                  {index === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
