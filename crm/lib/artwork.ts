const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|svg|bmp)$/i;

/** O anexo pode ser imagem ou documento; só imagem vira capa/preview e vai pro Instagram. */
export function isImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  if (url.startsWith("data:image/")) return true;
  try {
    return IMAGE_EXT.test(new URL(url).pathname);
  } catch {
    return IMAGE_EXT.test(url);
  }
}

export function isPdfUrl(url: string): boolean {
  try {
    return /\.pdf$/i.test(new URL(url).pathname);
  } catch {
    return /\.pdf$/i.test(url);
  }
}

export function fileNameOf(url: string): string {
  if (url.startsWith("data:")) return "imagem";
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() ?? url);
  } catch {
    return url;
  }
}

/** Extensão em maiúsculas (PDF, DOCX, ZIP...) para o selo do documento. */
export function fileExtOf(url: string): string {
  const name = fileNameOf(url);
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toUpperCase().slice(0, 5) : "ARQ";
}

/**
 * Baixa o arquivo (mesmo vindo de outro domínio, como o R2). Se o navegador bloquear a
 * leitura por CORS, abre o arquivo em outra aba para a pessoa salvar de lá.
 */
export async function downloadFile(url: string): Promise<void> {
  const name = fileNameOf(url);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("download");
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
