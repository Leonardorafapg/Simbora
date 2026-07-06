import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import Background from "@/components/site/Background";

export const metadata: Metadata = {
  title: "Simbora Maranhão — Marketing que move o Maranhão",
  description: "Agência de marketing no Maranhão. Gestão de mídias, tráfego pago e vídeos cinematográficos que transformam negócios locais.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#0D0D0D] text-white antialiased overflow-x-hidden">
        <Script id="reset-scroll-on-load" strategy="beforeInteractive">
          {`if ('scrollRestoration' in history) { history.scrollRestoration = 'manual'; } window.scrollTo(0, 0);`}
        </Script>
        <Background />
        {children}
      </body>
    </html>
  );
}
