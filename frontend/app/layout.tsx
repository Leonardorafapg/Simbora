import type { Metadata } from "next";
import "./globals.css";
import Background from "@/components/site/Background";

export const metadata: Metadata = {
  title: "Simbora Maranhão — Marketing que move o Maranhão",
  description: "Agência de marketing no Maranhão. Gestão de mídias, tráfego pago e vídeos cinematográficos que transformam negócios locais.",
  icons: {
    icon: "/images/logo.png",
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
        <Background />
        {children}
      </body>
    </html>
  );
}
