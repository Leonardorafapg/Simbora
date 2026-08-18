import Avatar from "@/components/ui/Avatar";
import type { SessionUser } from "@/types/auth";

type Props = {
  user: SessionUser;
};

export default function ProfileCard({ user }: Props) {
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center gap-4">
        <Avatar name={user.name} photoUrl={user.photo_url} size="lg" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white truncate">{user.name}</h2>
            {user.is_admin && (
              <span className="shrink-0 rounded-full bg-cyan/10 px-2 py-0.5 text-[11px] font-medium text-cyan">
                Admin
              </span>
            )}
          </div>
          <p className="text-sm text-white/50 truncate">{user.cargo}</p>
        </div>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-white/40">E-mail</dt>
          <dd className="mt-1 text-sm text-white/80">{user.email}</dd>
        </div>
        <div>
          <dt className="text-xs text-white/40">Cargo</dt>
          <dd className="mt-1 text-sm text-white/80">{user.cargo}</dd>
        </div>
      </dl>

      <p className="mt-5 text-xs text-white/40">
        Essas informações são somente leitura. Fale com um administrador para alterá-las.
      </p>
    </div>
  );
}
