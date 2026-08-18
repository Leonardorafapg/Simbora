import type { Client, ClientUpdateInput } from "@/types/client";
import type { TeamMember } from "@/types/team";
import ClientDetail from "./ClientDetail";

type CalendarPermissions = { canCreate: boolean; canEdit: boolean; canDelete: boolean };

type Props = {
  client: Client | null;
  canEdit: boolean;
  canDelete: boolean;
  canViewDemands: boolean;
  teamMembers: TeamMember[];
  calendarPermissions: CalendarPermissions;
  onClose: () => void;
  onUpdate: (id: number, input: ClientUpdateInput) => Promise<Client>;
  onRequestDelete: (client: Client) => void;
};

/**
 * Painel que cobre a área de conteúdo da página (não a navegação),
 * deslizando sobre a grade de cards. Não busca dados: recebe o cliente já
 * carregado pela página.
 */
export default function ClientDrawer({
  client,
  canEdit,
  canDelete,
  canViewDemands,
  teamMembers,
  calendarPermissions,
  onClose,
  onUpdate,
  onRequestDelete,
}: Props) {
  return (
    <div
      aria-hidden={!client}
      className={`absolute inset-0 z-40 transition-transform duration-300 ease-out ${
        client ? "translate-x-0" : "translate-x-full pointer-events-none"
      }`}
    >
      <div className="glass-modal h-full w-full rounded-2xl p-6 overflow-y-auto">
        {client && (
          <ClientDetail
            key={client.id}
            client={client}
            canEdit={canEdit}
            canDelete={canDelete}
            canViewDemands={canViewDemands}
            teamMembers={teamMembers}
            calendarPermissions={calendarPermissions}
            onBack={onClose}
            onUpdate={onUpdate}
            onRequestDelete={onRequestDelete}
          />
        )}
      </div>
    </div>
  );
}
