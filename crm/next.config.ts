import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `npm run build:verify` usa uma pasta de saída separada da do `next dev`
  // (.next), pra uma build de verificação nunca corromper o cache do
  // servidor de desenvolvimento que já esteja rodando ao mesmo tempo.
  distDir: process.env.BUILD_VERIFY ? ".next-verify" : ".next",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.FASTAPI_URL || "http://localhost:8000"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
