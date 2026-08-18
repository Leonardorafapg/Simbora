"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Briefcase, CalendarDays, User as UserIcon } from "lucide-react";
import { fetchSearchResults } from "@/services/client/searchApi";
import type { SearchResult } from "@/types/search";

const TYPE_ICON = {
  client: Briefcase,
  calendar_entry: CalendarDays,
  user: UserIcon,
} as const;

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

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await fetchSearchResults(term, controller.signal);
        setResults(data);
      } catch {
        // Busca abortada (novo termo digitado) — ignora, o próximo timer já assume.
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(result: SearchResult) {
    router.push(resultHref(result));
    setOpen(false);
    setQuery("");
  }

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative flex-1 max-w-sm">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Buscar clientes, posts, equipe..."
          className="glass-input w-full rounded-lg pl-9 pr-3 py-2 text-sm outline-none"
        />
      </label>

      {showDropdown && (
        <div className="glass-modal absolute left-0 right-0 top-full mt-2 rounded-lg z-50 max-h-96 overflow-y-auto">
          {loading && <p className="px-4 py-3 text-sm text-white/40">Buscando...</p>}

          {!loading && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-white/40">Nenhum resultado para &quot;{query.trim()}&quot;.</p>
          )}

          {!loading &&
            results.map((result) => {
              const Icon = TYPE_ICON[result.type];
              return (
                <button
                  key={`${result.type}-${result.id}`}
                  type="button"
                  onClick={() => handleSelect(result)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition"
                >
                  <Icon className="h-4 w-4 shrink-0 text-cyan" />
                  <span className="min-w-0">
                    <span className="block text-sm text-white truncate">{result.title}</span>
                    {result.subtitle && (
                      <span className="block text-xs text-white/40 truncate">{result.subtitle}</span>
                    )}
                  </span>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
