type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-text-muted",
  accent: "bg-accent-soft text-accent",
  success: "bg-emerald-500/15 text-emerald-400",
  warning: "bg-amber-400/15 text-amber-400",
  danger: "bg-danger/15 text-danger",
};

/** Selo/etiqueta pequeno para status e metadados. */
export default function Chip({ tone = "neutral", children, className = "" }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}
