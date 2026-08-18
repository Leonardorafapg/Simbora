import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Simbora CRM",
    short_name: "Simbora",
    description: "Painel operacional interno da Simbora.",
    start_url: "/",
    display: "standalone",
    // Só o `background_color` (a tela nativa de abertura do PWA, antes do
    // app carregar) é diferente do fundo escuro do resto do app — de
    // propósito, pra não parecer a mesma tela do LoginSplash pós-login.
    // `theme_color` continua igual ao `--color-dark`: é o que tinge a barra
    // de status durante o uso normal, não é a splash.
    background_color: "#0A3D4D",
    theme_color: "#1A1B1E",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
