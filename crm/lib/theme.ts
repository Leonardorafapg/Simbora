export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "simbora-crm-theme";

/**
 * Script inline (roda via <Script strategy="beforeInteractive"> antes da
 * hidratação) que aplica o tema salvo sem flash de conteúdo. Só existe
 * "light" como atributo: a ausência de data-theme já significa "dark".
 */
export const themeInitScript = `
try {
  if (localStorage.getItem("${THEME_STORAGE_KEY}") === "light") {
    document.documentElement.dataset.theme = "light";
  }
} catch {}
`;
