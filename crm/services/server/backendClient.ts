import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/services/server/session";

const API_BASE = "/api/v1";

function buildUrl(path: string) {
  return `${process.env.BACKEND_URL}${API_BASE}${path}`;
}

// Sem isso, uma requisição que trava sem responder (backend reiniciando,
// cold start, rede) nunca resolve nem rejeita — quem espera essa promise
// (ex.: o prefetch da splash de login) fica pendurado pra sempre.
const BACKEND_TIMEOUT_MS = 15_000;

/**
 * Envolve o fetch cru pra nunca deixar uma falha de rede (backend fora do ar,
 * DNS, timeout, etc.) virar exceção não tratada — isso derrubaria a rota inteira
 * com um 500 genérico do Next em vez da mensagem de erro que a UI sabe mostrar.
 * Sintetiza uma Response 503 no mesmo formato que o FastAPI usa (`detail`),
 * então `proxyJson`/`extractErrorMessage` lidam com ela sem saber a diferença.
 */
async function safeFetch(url: string, init: RequestInit) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS) });
  } catch {
    return NextResponse.json(
      { detail: "Não foi possível conectar ao servidor. Tente novamente em instantes." },
      { status: 503 },
    );
  }
}

/** Chamada ao backend sem autenticação (login). */
export async function backendFetchPublic(path: string, init: RequestInit = {}) {
  return safeFetch(buildUrl(path), {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
}

/** Chamada ao backend repassando o JWT guardado no cookie da sessão. */
export async function backendFetch(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  return safeFetch(buildUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}

/**
 * Igual `backendFetch`, mas para `multipart/form-data` (upload de arquivo).
 * Sem `Content-Type` fixo de propósito — o fetch precisa gerar sozinho o
 * boundary do multipart a partir do FormData; forçar o header quebra o parse
 * no backend.
 */
export async function backendFetchMultipart(path: string, formData: FormData) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  return safeFetch(buildUrl(path), {
    method: "POST",
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/**
 * Extrai a mensagem de erro do FastAPI. O campo `detail` vem como string em
 * erros de negócio (HTTPException) e como lista em erros de validação do
 * Pydantic (422) — sem tratar os dois, a UI mostraria "[object Object]".
 */
export function extractErrorMessage(data: unknown, fallback: string): string {
  const detail = (data as { detail?: unknown } | null)?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: string } | undefined;
    if (typeof first?.msg === "string") {
      return first.msg.replace(/^Value error,\s*/, "");
    }
  }

  return fallback;
}

/** Repassa a resposta do backend como resposta da rota do Next. */
export async function proxyJson(res: Response, fallback: string, successStatus = 200) {
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return NextResponse.json({ message: extractErrorMessage(data, fallback) }, { status: res.status });
  }

  return NextResponse.json(data, { status: successStatus });
}
