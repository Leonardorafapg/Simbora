"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Moon, Sparkles, Sun } from "lucide-react";
import { DENSITY_STORAGE_KEY, THEME_STORAGE_KEY, type Density, type Theme } from "@/lib/theme";

const NEXT_THEME: Record<Theme, Theme> = { dark: "light", light: "neon", neon: "dark" };

/** Nome do tema PARA O QUAL o próximo clique troca (rótulo de botões e menus). */
export const NEXT_THEME_LABEL: Record<Theme, string> = {
  dark: "Tema claro",
  light: "Tema neon",
  neon: "Tema escuro",
};

/** Ícone do tema atual. */
export function ThemeIcon({ theme, className = "h-4 w-4" }: { theme: Theme | null; className?: string }) {
  if (theme === "light") return <Moon className={className} />;
  if (theme === "neon") return <Sparkles className={className} />;
  return <Sun className={className} />;
}

// Último ponto de clique/toque, usado como origem da animação (o toggle também é
// acionado por menu e paleta de comandos, que não passam o evento).
let lastPointer: { x: number; y: number; at: number } | null = null;
const POINTER_FRESH_MS = 1500;
if (typeof window !== "undefined") {
  window.addEventListener(
    "pointerdown",
    (e) => {
      lastPointer = { x: e.clientX, y: e.clientY, at: e.timeStamp };
    },
    { capture: true, passive: true },
  );
}

/** Onde o círculo nasce: o clique recente; senão (teclado/paleta) o elemento em foco; senão o canto do topo. */
function animationOrigin(): { x: number; y: number } {
  if (lastPointer && performance.now() - lastPointer.at < POINTER_FRESH_MS) return lastPointer;
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body && active.closest("[data-theme-origin]")) {
    const r = active.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return { x: window.innerWidth - 40, y: 40 };
}

function readTheme(): Theme {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "neon" ? t : "dark";
}

/** Estado e ação do tema (escuro → claro → neon), reaproveitados pelo botão do topo, pelo menu da conta e pela paleta. */
export function useThemeToggle() {
  // Começa null: o tema real já foi aplicado ao <html> pelo script inline
  // antes da hidratação, então só sincronizamos depois do mount pra não
  // arriscar um mismatch de hidratação lendo o DOM durante o render.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com o data-theme já aplicado ao DOM pelo script anti-flash
    setTheme(readTheme());
  }, []);

  function toggle() {
    // Lê do DOM (fonte da verdade) para que cliques rápidos em sequência não usem um estado velho.
    const next = NEXT_THEME[readTheme()];

    const apply = () => {
      setTheme(next);
      if (next === "dark") delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = next;
    };

    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // localStorage indisponível — o tema só não persiste entre sessões.
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || typeof document.startViewTransition !== "function") {
      apply();
      return;
    }

    // Revela o novo tema num círculo que cresce a partir do último clique.
    const { x, y } = animationOrigin();
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const transition = document.startViewTransition(() => flushSync(apply));
    transition.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 600, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
        );
      })
      .catch(() => {});
  }

  return { theme, toggle };
}

/** Densidade da interface (confortável ou compacta), aplicada como `data-density` no <html>. */
export function useDensity() {
  const [density, setDensity] = useState<Density>("comfortable");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com o data-density já aplicado ao DOM
    setDensity(document.documentElement.dataset.density === "compact" ? "compact" : "comfortable");
  }, []);

  function toggleDensity() {
    const next: Density = density === "compact" ? "comfortable" : "compact";
    setDensity(next);
    if (next === "compact") document.documentElement.dataset.density = "compact";
    else delete document.documentElement.dataset.density;
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, next);
    } catch {
      // sem persistência
    }
  }

  return { density, toggleDensity };
}

export default function ThemeToggle() {
  const { theme, toggle } = useThemeToggle();

  return (
    <button
      type="button"
      onClick={toggle}
      data-theme-origin
      aria-label={`Mudar para ${NEXT_THEME_LABEL[theme ?? "dark"].toLowerCase()}`}
      title={NEXT_THEME_LABEL[theme ?? "dark"]}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
    >
      <ThemeIcon theme={theme} />
    </button>
  );
}
