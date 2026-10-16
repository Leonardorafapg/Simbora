import type { TagColor } from "@/types/tag";

/** Classes estáticas (o Tailwind só gera o que aparece literal no código). */
export const TAG_COLOR_CLASSES: Record<TagColor, { chip: string; swatch: string; label: string }> = {
  green: { chip: "bg-emerald-700 text-emerald-50", swatch: "bg-emerald-700", label: "Verde" },
  yellow: { chip: "bg-yellow-600 text-yellow-50", swatch: "bg-yellow-600", label: "Amarelo" },
  orange: { chip: "bg-orange-700 text-orange-100", swatch: "bg-orange-700", label: "Laranja" },
  red: { chip: "bg-red-700 text-red-50", swatch: "bg-red-700", label: "Vermelho" },
  purple: { chip: "bg-purple-700 text-purple-50", swatch: "bg-purple-700", label: "Roxo" },
  blue: { chip: "bg-blue-700 text-blue-50", swatch: "bg-blue-700", label: "Azul" },
  teal: { chip: "bg-teal-800 text-teal-50", swatch: "bg-teal-800", label: "Azul-petróleo" },
  lime: { chip: "bg-lime-700 text-lime-50", swatch: "bg-lime-700", label: "Lima" },
  pink: { chip: "bg-pink-700 text-pink-50", swatch: "bg-pink-700", label: "Rosa" },
  gray: { chip: "bg-slate-600 text-slate-50", swatch: "bg-slate-600", label: "Cinza" },
};

export function tagChipClass(color: string): string {
  return (TAG_COLOR_CLASSES as Record<string, { chip: string }>)[color]?.chip ?? TAG_COLOR_CLASSES.gray.chip;
}
