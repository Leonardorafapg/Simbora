import { NextRequest } from "next/server";
import { backendFetchMultipart, proxyJson } from "@/services/server/backendClient";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const res = await backendFetchMultipart("/uploads/image", formData);
  return proxyJson(res, "Falha ao enviar a imagem");
}
