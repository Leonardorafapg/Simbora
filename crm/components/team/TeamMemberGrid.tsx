import type { TeamMember } from "@/types/team";
import TeamMemberCard from "./TeamMemberCard";

type Props = {
  members: TeamMember[];
  canManage: boolean;
  onSelect: (member: TeamMember) => void;
  onAddClick: () => void;
};

export default function TeamMemberGrid({ members, canManage, onSelect, onAddClick }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {members.map((member) => (
        <TeamMemberCard key={member.id} member={member} onClick={() => onSelect(member)} />
      ))}

      {canManage && (
        <button
          type="button"
          onClick={onAddClick}
          className="rounded-2xl border border-dashed border-white/15 min-h-[132px] flex items-center justify-center text-sm text-white/50 hover:border-cyan/50 hover:text-cyan transition-colors"
        >
          + Novo membro
        </button>
      )}
    </div>
  );
}
