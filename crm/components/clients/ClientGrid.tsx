import type { Client } from "@/types/client";
import type { TeamDirectoryEntry } from "@/types/team";
import ClientCard from "./ClientCard";

type Props = {
  clients: Client[];
  teamMembers: TeamDirectoryEntry[];
  canCreate: boolean;
  onSelect: (client: Client) => void;
  onAddClick: () => void;
};

export default function ClientGrid({ clients, teamMembers, canCreate, onSelect, onAddClick }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {clients.map((client, index) => (
        <div key={client.id} className="animate-fade-up stagger" style={{ "--i": index } as React.CSSProperties}>
          <ClientCard
            client={client}
            social={teamMembers.find((m) => m.id === client.default_social_id)}
            designer={teamMembers.find((m) => m.id === client.default_designer_id)}
            onClick={() => onSelect(client)}
          />
        </div>
      ))}

      {canCreate && (
        <button
          type="button"
          onClick={onAddClick}
          style={{ "--i": clients.length } as React.CSSProperties}
          className="animate-fade-up stagger rounded-2xl border border-dashed border-border min-h-[132px] flex items-center justify-center text-sm text-text-muted hover:border-cyan/50 hover:text-cyan transition-colors"
        >
          + Novo cliente
        </button>
      )}
    </div>
  );
}
