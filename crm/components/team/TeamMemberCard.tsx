import type { TeamMember } from "@/types/team";
import Avatar from "@/components/ui/Avatar";

type Props = {
  member: TeamMember;
  onClick: () => void;
};

export default function TeamMemberCard({ member, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-card text-left rounded-2xl p-5 flex flex-col gap-3 transition-all hover:border-cyan/50 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-2">
        <Avatar name={member.full_name} photoUrl={member.photo_url} />
        {!member.is_active && (
          <span className="text-[10px] rounded-full border border-border-hover px-2 py-0.5 text-text-muted">
            Inativo
          </span>
        )}
      </div>

      <div className="min-w-0">
        <p className="font-semibold text-text truncate">{member.full_name}</p>
        <p className="text-xs text-cyan truncate">{member.cargo}</p>
      </div>
    </button>
  );
}
