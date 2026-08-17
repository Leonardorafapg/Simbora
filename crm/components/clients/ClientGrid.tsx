import type { Client } from "@/types/client";
import ClientCard from "./ClientCard";

type Props = {
  clients: Client[];
  canCreate: boolean;
  onSelect: (client: Client) => void;
  onAddClick: () => void;
};

export default function ClientGrid({ clients, canCreate, onSelect, onAddClick }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {clients.map((client) => (
        <ClientCard key={client.id} client={client} onClick={() => onSelect(client)} />
      ))}

      {canCreate && (
        <button
          type="button"
          onClick={onAddClick}
          className="rounded-2xl border border-dashed border-white/15 min-h-[132px] flex items-center justify-center text-sm text-white/50 hover:border-cyan/50 hover:text-cyan transition-colors"
        >
          + Novo cliente
        </button>
      )}
    </div>
  );
}
