import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import "./globals.css";
import { themeInitScript } from "@/lib/theme";
import ServiceWorkerRegister from "@/components/pwa/ServiceWorkerRegister";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });

export const metadata: Metadata = {
  title: "Simbora CRM",
  description: "Painel operacional interno da Simbora.",
  robots: {
    index: false,
    follow: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "Simbora",
  },
  // O Next só emite o mobile-web-app-capable; iOS antigos ainda exigem o da Apple para abrir sem barra do Safari.
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#1A1B1E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${inter.variable} ${bricolage.variable}`}>
      <body className="bg-dark text-text antialiased">
        {/* Inline puro em vez de next/script: precisa rodar antes do paint pra
            evitar flash de tema, e o <Script beforeInteractive> quebra o
            render do RootLayout nessa versão do Next. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
