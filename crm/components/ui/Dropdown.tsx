"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";

export type DropdownOption<T extends string> = { value: T; label: string; hint?: string };

/**
 * Dropdown em pílula: gatilho arredondado com o valor atual + chevron e menu
 * flutuante com check no item selecionado. Para filtros e seletores de destaque;
 * em formulários longos o <select> nativo continua (`glass-input`).
 */
export default function Dropdown<T extends string>({
  value,
  onChange,
  options,
  icon,
  fullWidth = false,
  align = "left",
  ariaLabel,
  disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: DropdownOption<T>[];
  icon?: ReactNode;
  fullWidth?: boolean;
  align?: "left" | "right";
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  // Abre pra cima quando não há espaço embaixo (ex.: campo no fim de um modal).
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    setUp(below < 260 && r.top > below);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${fullWidth ? "w-full" : ""}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={`flex cursor-pointer items-center gap-2 rounded-full border bg-transparent px-4 py-1.5 text-[12.5px] font-medium text-text transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? "border-accent-border bg-surface-2" : "border-border-hover"
        } ${fullWidth ? "w-full" : ""}`}
      >
        {icon && <span className="flex flex-none text-text-muted">{icon}</span>}
        <span className="min-w-0 flex-1 truncate text-left">{current?.label ?? "—"}</span>
        <ChevronDown size={14} className={`flex-none text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute z-40 max-h-64 w-max min-w-full max-w-[min(280px,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-border bg-surface py-1 shadow-menu ${
            up ? "bottom-full mb-1" : "mt-1"
          } ${align === "right" ? "right-0" : "left-0"}`}
        >
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center justify-between gap-3 border-none bg-transparent px-4 py-2 text-left text-[13px] hover:bg-surface-2 ${
                  selected ? "font-medium text-accent" : "text-text"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate">{o.label}</span>
                  {o.hint && <span className="block truncate text-[11px] font-normal text-text-faint">{o.hint}</span>}
                </span>
                {selected && <Check size={14} className="flex-none" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
