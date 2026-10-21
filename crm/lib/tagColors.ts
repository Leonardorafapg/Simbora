import { TAG_COLOR_KEYS, type TagColor } from "@/types/tag";

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

/** Hex aproximado de cada cor da paleta — usado só pra ordenar junto com hex customizado, não pra render. */
const PALETTE_HEX: Record<TagColor, string> = {
  green: "#047857",
  yellow: "#ca8a04",
  orange: "#c2410c",
  red: "#b91c1c",
  purple: "#7e22ce",
  blue: "#1d4ed8",
  teal: "#115e59",
  lime: "#4d7c0f",
  pink: "#be185d",
  gray: "#475569",
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isPaletteColor(color: string): color is TagColor {
  return (TAG_COLOR_KEYS as readonly string[]).includes(color);
}

export function isHexColor(color: string): boolean {
  return HEX_RE.test(color);
}

/** Classes Tailwind pra cor da paleta; hex customizado usa tagChipStyle (inline) em vez disso. */
export function tagChipClass(color: string): string {
  return isPaletteColor(color) ? TAG_COLOR_CLASSES[color].chip : "";
}

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

/** Preto ou branco, o que der mais contraste (luminância relativa, fórmula W3C simplificada). */
export function contrastTextColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111111" : "#f8fafc";
}

/** Estilo inline pra cor hex customizada; undefined pra cor da paleta (usa tagChipClass). */
export function tagChipStyle(color: string): { backgroundColor: string; color: string } | undefined {
  if (!isHexColor(color)) return undefined;
  return { backgroundColor: color, color: contrastTextColor(color) };
}

function hexToHue(hex: string): [number, number, number] {
  const [r8, g8, b8] = hexToRgb(hex);
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  return [h * 60, s, l];
}

/**
 * Chave de ordenação por matiz (roda de cores) — mesma lógica do backend
 * (ver backend/app/core/tag_colors.py), pra reordenar localmente depois de
 * criar/editar sem precisar esperar um refetch.
 */
export function tagColorSortKey(color: string): [number, number, number] {
  const hex = isPaletteColor(color) ? PALETTE_HEX[color] : isHexColor(color) ? color : PALETTE_HEX.gray;
  const [h, s, l] = hexToHue(hex);
  return [Math.round(h), -l, -s];
}
