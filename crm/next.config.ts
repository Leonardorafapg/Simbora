import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `npm run build:verify` usa uma pasta de saída separada da do `next dev`
  // (.next), pra uma build de verificação nunca corromper o cache do
  // servidor de desenvolvimento que já esteja rodando ao mesmo tempo.
  distDir: process.env.BUILD_VERIFY ? ".next-verify" : ".next",
  // Sem rewrite de /api/* para o FastAPI: aqui o browser fala só com as Route
  // Handlers em app/api/*, que anexam o JWT do cookie httpOnly (ver AGENTS.md).
  // Uma rewrite `/api/:path*` (herdada do site público, que não tem handlers
  // próprios) é resolvida ANTES das rotas dinâmicas, então engolia todo
  // `app/api/*/[id]` — PATCH e DELETE caíam direto no backend com o caminho
  // errado e voltavam 404.
};

export default nextConfig;
