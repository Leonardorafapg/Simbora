import type { Client, ClientUpdateInput } from "@/types/client";
import type { TeamDirectoryEntry } from "@/types/team";
import ClientDetail from "./ClientDetail";

type CalendarPermissions = { canCreate: boolean; canEdit: boolean; canDelete: boolean; canApprove: boolean };
type InstagramPermissions = { canView: boolean; canManage: boolean };

type Props = {
  client: Client | null;
  canEdit: boolean;
  canDelete: boolean;
  teamMembers: TeamDirectoryEntry[];
  calendarPermissions: CalendarPermissions;
  instagramPermissions: InstagramPermissions;
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
  teamMembers,
  calendarPermissions,
  instagramPermissions,
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
      <div className="glass-modal h-full w-full rounded-2xl p-4 sm:p-6 overflow-y-auto">
        {client && (
          <ClientDetail
            key={client.id}
            client={client}
            canEdit={canEdit}
            canDelete={canDelete}
            teamMembers={teamMembers}
            calendarPermissions={calendarPermissions}
            instagramPermissions={instagramPermissions}
            onBack={onClose}
            onUpdate={onUpdate}
            onRequestDelete={onRequestDelete}
          />
        )}
      </div>
    </div>
  );
}
