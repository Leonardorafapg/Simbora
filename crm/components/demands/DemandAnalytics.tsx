import type { Demand } from "@/types/demand";
import { isDemandOverdue } from "@/types/demand";

type Props = {
  demands: Demand[];
};

export default function DemandAnalytics({ demands }: Props) {
  const total = demands.length;
  const pendentes = demands.filter((d) => d.status === "pendente").length;
  const emAndamento = demands.filter((d) => d.status === "em_andamento" || d.status === "em_aprovacao").length;
  const concluidas = demands.filter((d) => d.status === "concluida").length;
  const atrasadas = demands.filter(isDemandOverdue).length;

  const stats = [
    { label: "Total de demandas", value: total, color: "text-white" },
    { label: "Pendentes", value: pendentes, color: "text-white/70" },
    { label: "Em andamento", value: emAndamento, color: "text-amber-400" },
    { label: "Atrasadas", value: atrasadas, color: "text-danger" },
    { label: "Concluídas", value: concluidas, color: "text-emerald-400" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {stats.map((stat) => (
        <div key={stat.label} className="glass-card rounded-2xl p-4">
          <p className={`text-2xl font-semibold ${stat.color}`}>{stat.value}</p>
          <p className="text-xs text-white/40 mt-1">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
