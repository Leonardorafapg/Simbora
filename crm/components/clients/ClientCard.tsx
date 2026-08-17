import type { Client } from "@/types/client";
import Avatar from "@/components/ui/Avatar";

type Props = {
  client: Client;
  onClick: () => void;
};

export default function ClientCard({ client, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-card text-left rounded-2xl p-5 flex flex-col gap-3 transition-all hover:border-cyan/50 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-2">
        <Avatar name={client.name} />
        {!client.is_active && (
          <span className="text-[10px] rounded-full border border-white/20 px-2 py-0.5 text-white/50">
            Inativo
          </span>
        )}
      </div>

      <div className="min-w-0">
        <p className="font-semibold text-white truncate">{client.name}</p>
        <p className="text-xs text-cyan truncate">{client.contact_name || client.email || "—"}</p>
      </div>
    </button>
  );
}
