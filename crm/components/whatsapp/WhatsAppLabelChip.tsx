import type { WhatsAppLabel } from "@/types/whatsapp";

// Paleta das etiquetas do WhatsApp Business — a Evolution manda só o índice
// (0-19), a cor de verdade é a que o app do celular mostra.
const LABEL_COLORS = [
  "#ff9485", "#64c4ff", "#ffd429", "#dfaef0", "#99b6c1",
  "#55ccb3", "#ff9dff", "#d3a91d", "#6d7cce", "#d7e752",
  "#00d0e2", "#ffc5c7", "#93ceac", "#f74848", "#00a0f2",
  "#83e422", "#ffaf04", "#b5ebff", "#9ba6ff", "#9368cf",
];

export function labelColor(color: number): string {
  return LABEL_COLORS[color] ?? LABEL_COLORS[0];
}

export default function WhatsAppLabelChip({ label }: { label: WhatsAppLabel }) {
  const color = labelColor(label.color);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-medium max-w-[9rem]"
      style={{ backgroundColor: `${color}26`, color }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="truncate">{label.name}</span>
    </span>
  );
}
