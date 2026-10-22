/** Bloco de carregamento com brilho em movimento (classe `.skeleton` em globals.css). */
export default function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-md ${className}`} />;
}

/** Barra fina de progresso indeterminado, para carregamentos de tela inteira. */
export function TopProgress() {
  return (
    <div role="progressbar" aria-label="Carregando" className="h-0.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div className="progress-bar h-full w-1/3 rounded-full bg-accent" />
    </div>
  );
}
