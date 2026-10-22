export type Theme = "dark" | "light" | "neon";
export type Density = "comfortable" | "compact";

export const THEME_STORAGE_KEY = "simbora-crm-theme";
export const DENSITY_STORAGE_KEY = "simbora-crm-density";

/**
 * Script inline (roda antes da hidratação) que aplica tema e densidade salvos
 * sem flash de conteúdo. Só "light" e "neon" viram atributo: a ausência de
 * data-theme já significa "dark"; e só "compact" vira data-density.
 */
export const themeInitScript = `
try {
  var t = localStorage.getItem("${THEME_STORAGE_KEY}");
  if (t === "light" || t === "neon") document.documentElement.dataset.theme = t;
  if (localStorage.getItem("${DENSITY_STORAGE_KEY}") === "compact") document.documentElement.dataset.density = "compact";
} catch {}
`;
