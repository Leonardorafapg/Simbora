"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";

export type MultiSelectOption = { value: number; label: string };

/**
 * Filtro de múltipla escolha em pílula: o menu tem caixas de seleção e o gatilho resume a escolha
 * ("Todos os clientes" quando vazio, o nome quando há um, "3 clientes" quando há vários).
 * Vazio = sem filtro. Combina com os outros filtros (E entre filtros, OU entre as opções).
 */
export default function MultiSelect({
  options,
  value,
  onChange,
  allLabel,
  pluralLabel,
  ariaLabel,
  fullWidth = false,
}: {
  options: MultiSelectOption[];
  value: number[];
  onChange: (value: number[]) => void;
  /** Texto com nada selecionado, ex.: "Todos os clientes". */
  allLabel: string;
  /** Substantivo no plural para o resumo, ex.: "clientes". */
  pluralLabel: string;
  ariaLabel?: string;
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.filter((o) => value.includes(o.value));
  const summary =
    selected.length === 0 ? allLabel : selected.length === 1 ? selected[0].label : `${selected.length} ${pluralLabel}`;

  function toggle(id: number) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  return (
    <div ref={ref} className={`relative ${fullWidth ? "w-full" : ""}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? allLabel}
        onClick={() => setOpen((o) => !o)}
        className={`glass-input flex ${fullWidth ? "w-full" : "max-w-[260px]"} items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none ${
          selected.length > 0 ? "border-accent-border" : ""
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-left">{summary}</span>
        {selected.length > 0 ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={`Limpar ${pluralLabel}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.stopPropagation();
                onChange([]);
              }
            }}
            className="flex shrink-0 rounded-full p-0.5 text-text-muted hover:bg-surface-2 hover:text-text"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronDown className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute left-0 z-40 mt-1 max-h-72 w-max min-w-full max-w-[min(300px,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-border bg-surface py-1 shadow-menu"
        >
          {options.length === 0 && <p className="px-4 py-2 text-[13px] text-text-faint">Nada para escolher.</p>}
          {options.map((o) => {
            const checked = value.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={checked}
                onClick={() => toggle(o.value)}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-[13px] text-text hover:bg-surface-2"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    checked ? "border-accent bg-accent text-black" : "border-border-hover"
                  }`}
                >
                  {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className="min-w-0 truncate">{o.label}</span>
              </button>
            );
          })}
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1 w-full border-t border-border px-4 py-2 text-left text-[12px] text-text-muted hover:bg-surface-2 hover:text-text"
            >
              Limpar seleção
            </button>
          )}
        </div>
      )}
    </div>
  );
}
