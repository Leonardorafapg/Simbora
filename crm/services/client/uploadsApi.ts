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
async function uploadFile(
  file: File,
  noun: "a imagem" | "o arquivo",
  presignPath = "/api/uploads/presign",
): Promise<string> {
  const presignRes = await fetch(presignPath, {
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

/** Arte finalizada do post: imagem ou documento (PDF, Word, Excel, PowerPoint, ZIP). */
export function uploadArtwork(file: File): Promise<string> {
  return uploadFile(file, "o arquivo", "/api/uploads/presign-artwork");
}

/** Imagem ou vídeo (MP4/MOV) — usado no agendamento do Instagram. */
export function uploadMedia(file: File): Promise<string> {
  return uploadFile(file, "o arquivo");
}

/** Mesma mecânica de `uploadImage`, mas pro PDF do calendário (fluxo de aprovação). */
export async function uploadDocument(blob: Blob, contentType = "application/pdf"): Promise<string> {
  const presignRes = await fetch("/api/uploads/presign-document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content_type: contentType, size: blob.size }),
  });
  if (!presignRes.ok) {
    throw new Error(await parseErrorMessage(presignRes, "Não foi possível enviar o documento."));
  }

  const presigned: PresignedUpload = await presignRes.json();

  let putRes: Response;
  try {
    putRes = await fetch(presigned.upload_url, {
      method: "PUT",
      headers: presigned.headers,
      body: blob,
    });
  } catch {
    throw new Error("Não foi possível enviar o documento. Verifique sua conexão e tente novamente.");
  }
  if (!putRes.ok) throw new Error("O armazenamento recusou o documento. Tente novamente.");

  return presigned.url;
}
