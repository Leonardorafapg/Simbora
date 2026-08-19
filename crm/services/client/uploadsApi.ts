async function parseErrorMessage(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return data.message ?? fallback;
}

/** Envia a imagem pro Cloudinary (via backend) e devolve a URL definitiva. */
export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/uploads", { method: "POST", body: formData });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Não foi possível enviar a imagem."));

  const data: { url: string } = await res.json();
  return data.url;
}
