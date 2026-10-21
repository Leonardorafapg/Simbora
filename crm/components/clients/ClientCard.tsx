import type { Client } from "@/types/client";
import Avatar from "@/components/ui/Avatar";
import type { TeamDirectoryEntry } from "@/types/team";
import { tagChipClass } from "@/lib/tagColors";

type Props = {
  client: Client;
  /** Social media e designer padrão do cliente (mostrados como etiquetas fixas). */
  social?: TeamDirectoryEntry;
  designer?: TeamDirectoryEntry;
  onClick: () => void;
};

export default function ClientCard({ client, social, designer, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-card text-left rounded-2xl p-5 flex flex-col gap-3 transition-all hover:border-cyan/50 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-2">
        <Avatar name={client.name} photoUrl={client.photo_url} />
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

      {/* Etiquetas padrão (fixas): quem é o social e o designer do cliente. */}
      <div className="flex flex-wrap gap-1.5">
        <span
          title={social ? `Social media: ${social.full_name}` : "Sem social media padrão"}
          className={`max-w-full truncate rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
            social ? tagChipClass("yellow") : "bg-white/10 text-white/40"
          }`}
        >
          Social: {social?.full_name ?? "—"}
        </span>
        <span
          title={designer ? `Designer: ${designer.full_name}` : "Sem designer padrão"}
          className={`max-w-full truncate rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
            designer ? tagChipClass("purple") : "bg-white/10 text-white/40"
          }`}
        >
          Designer: {designer?.full_name ?? "—"}
        </span>
      </div>
    </button>
  );
}
