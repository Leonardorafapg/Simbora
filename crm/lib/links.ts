/** "drive.google.com/x" -> "https://drive.google.com/x". Devolve null se não for um link http(s) válido. */
export function normalizeUrl(input: string): string | null {
  const value = input.trim();
  if (!value || /\s/.test(value)) return null;
  // "javascript:...", "mailto:..." etc. (esquema sem //) nunca viram link.
  if (/^[a-z][a-z0-9+.-]*:(?!\/\/|\d+(\/|$))/i.test(value)) return null;
  const withScheme = value.includes("://") ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
    return withScheme;
  } catch {
    return null;
  }
}

const KNOWN_HOSTS: [RegExp, string][] = [
  [/(^|\.)drive\.google\.com$/, "Google Drive"],
  [/(^|\.)docs\.google\.com$/, "Google Docs"],
  [/(^|\.)figma\.com$/, "Figma"],
  [/(^|\.)canva\.com$/, "Canva"],
  [/(^|\.)dropbox\.com$/, "Dropbox"],
  [/(^|\.)(onedrive\.live\.com|1drv\.ms|sharepoint\.com)$/, "OneDrive"],
  [/(^|\.)notion\.(so|site)$/, "Notion"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
  [/(^|\.)wetransfer\.com$/, "WeTransfer"],
];

/** Nome curto do destino ("Google Drive", "figma.com") pra mostrar no lugar da URL gigante. */
export function linkLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return KNOWN_HOSTS.find(([re]) => re.test(host))?.[1] ?? host;
  } catch {
    return url;
  }
}

export type TextPart = { type: "text"; value: string } | { type: "link"; value: string; href: string };

const URL_IN_TEXT = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
// Pontuação que costuma vir colada no fim do link numa frase ("veja https://x.com.").
const TRAILING_PUNCT = /[.,;:!?)\]}]+$/;

/** Quebra o texto em pedaços de texto e links clicáveis. */
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_IN_TEXT)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const trimmed = raw.replace(TRAILING_PUNCT, "");
    const href = normalizeUrl(trimmed);
    if (!href) continue;
    if (start > last) parts.push({ type: "text", value: text.slice(last, start) });
    parts.push({ type: "link", value: trimmed, href });
    last = start + trimmed.length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}

/** Só os links do texto (sem repetir), na ordem em que aparecem. */
export function extractLinks(text: string): string[] {
  const hrefs = splitLinks(text).flatMap((p) => (p.type === "link" ? [p.href] : []));
  return hrefs.filter((href, i) => hrefs.indexOf(href) === i);
}
