"use client";

import { useEffect, useRef, useState } from "react";

/** Valor que anima do anterior até o novo (easeOutCubic). Respeita `prefers-reduced-motion`. */
export function useCountUp(value: number, duration = 700, delay = 0): number {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    if (reduce || from === value) {
      fromRef.current = value;
      setShown(value);
      return;
    }
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, Math.max(0, (now - start - delay) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(from + (value - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, delay]);

  return shown;
}

/** Número inteiro que "conta" até o valor. */
export default function CountUp({ value, duration = 700 }: { value: number; duration?: number }) {
  const shown = useCountUp(value, duration);
  return <span className="tabular-nums">{Math.round(shown)}</span>;
}
