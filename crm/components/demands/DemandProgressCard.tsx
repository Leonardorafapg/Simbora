type Props = {
  total: number;
  completed: number;
  /** Ex.: "Demandas do cliente", "Demandas do responsável". */
  label?: string;
};

export default function DemandProgressCard({ total, completed, label = "Demandas" }: Props) {
  const pending = total - completed;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="glass-card w-full rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">{label}</p>
        <span className="text-sm text-cyan font-semibold">{percent}%</span>
      </div>

      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-cyan transition-all" style={{ width: `${percent}%` }} />
      </div>

      {total > 0 ? (
        <p className="text-xs text-white/50">
          {completed}/{total} concluídas
          {pending > 0 && ` · ${pending} em aberto`}
        </p>
      ) : (
        <p className="text-xs text-white/40">Nenhuma demanda registrada ainda.</p>
      )}
    </div>
  );
}
