import type { LucideIcon } from "lucide-react";

/**
 * Card de seção das telas de configuração: título com ícone opcional + subtítulo,
 * moldura sutil para separar blocos sem linhas soltas na página.
 */
export default function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
  className = "",
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-border bg-surface p-5 shadow-[var(--elev-card)] md:p-6 ${className}`}>
      <div className="mb-5 flex items-start gap-3">
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Icon size={17} />
          </div>
        )}
        <div>
          <h2 className="text-[15px] font-semibold text-text">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-text-muted">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
