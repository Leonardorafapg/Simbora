import type { TeamMember, TeamMemberUpdateInput } from "@/types/team";
import TeamMemberDetail from "./TeamMemberDetail";

type Props = {
  member: TeamMember | null;
  canManage: boolean;
  onClose: () => void;
  onUpdate: (id: number, input: TeamMemberUpdateInput) => Promise<TeamMember>;
  onRequestDelete: (member: TeamMember) => void;
};

/**
 * Painel que cobre a área de conteúdo da página (não a navegação),
 * deslizando sobre a grade de cards. Não busca dados: recebe o membro já
 * carregado pela página.
 */
export default function TeamMemberDrawer({ member, canManage, onClose, onUpdate, onRequestDelete }: Props) {
  return (
    <div
      aria-hidden={!member}
      className={`absolute inset-0 z-40 transition-transform duration-300 ease-out ${
        member ? "translate-x-0" : "translate-x-full pointer-events-none"
      }`}
    >
      <div className="glass-modal h-full w-full rounded-2xl p-6 overflow-y-auto">
        {member && (
          <TeamMemberDetail
            key={member.id}
            member={member}
            canManage={canManage}
            onBack={onClose}
            onUpdate={onUpdate}
            onRequestDelete={onRequestDelete}
          />
        )}
      </div>
    </div>
  );
}
