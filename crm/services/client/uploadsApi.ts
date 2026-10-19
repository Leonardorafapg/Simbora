async function parseErrorMessage(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return data.message ?? fallback;
}

interface PresignedUpload {
  upload_url: string;
  headers: Record<string, string>;
  url: string;
}

/**
 * Envia o arquivo direto pro R2 por URL pré-assinada (o arquivo não passa pelo
 * Next nem pelo backend) e devolve a URL pública definitiva.
 */
async function uploadFile(file: File, noun: "a imagem" | "o arquivo"): Promise<string> {
  const presignRes = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content_type: file.type, size: file.size }),
  });
  if (!presignRes.ok) {
    throw new Error(await parseErrorMessage(presignRes, `Não foi possível enviar ${noun}.`));
  }

  const presigned: PresignedUpload = await presignRes.json();

  let putRes: Response;
  try {
    putRes = await fetch(presigned.upload_url, {
      method: "PUT",
      headers: presigned.headers,
      body: file,
    });
  } catch {
    // Falha de rede ou CORS do bucket mal configurado — o browser não distingue.
    throw new Error(`Não foi possível enviar ${noun}. Verifique sua conexão e tente novamente.`);
  }
  if (!putRes.ok) throw new Error(`O armazenamento recusou ${noun}. Tente novamente.`);

  return presigned.url;
}

export function uploadImage(file: File): Promise<string> {
  return uploadFile(file, "a imagem");
}

/** Imagem ou vídeo (MP4/MOV) — usado no agendamento do Instagram. */
export function uploadMedia(file: File): Promise<string> {
  return uploadFile(file, "o arquivo");
}
