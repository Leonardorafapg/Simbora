/** Cabeçalho padrão das telas: título, descrição curta e ações à direita. */
export default function PageHeader({
  title,
  description,
  actions,
  className = "mb-6",
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={`flex shrink-0 flex-wrap items-end justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-text">{title}</h1>
        {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
