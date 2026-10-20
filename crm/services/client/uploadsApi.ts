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
 * Envia a imagem direto pro R2 por URL pré-assinada (o arquivo não passa pelo
 * Next nem pelo backend) e devolve a URL pública definitiva.
 */
export async function uploadImage(file: File): Promise<string> {
  const presignRes = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content_type: file.type, size: file.size }),
  });
  if (!presignRes.ok) {
    throw new Error(await parseErrorMessage(presignRes, "Não foi possível enviar a imagem."));
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
    throw new Error("Não foi possível enviar a imagem. Verifique sua conexão e tente novamente.");
  }
  if (!putRes.ok) throw new Error("O armazenamento recusou a imagem. Tente novamente.");

  return presigned.url;
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
