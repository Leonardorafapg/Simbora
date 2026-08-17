import type { Metadata } from "next";
import "./globals.css";
import { themeInitScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Simbora CRM",
  description: "Painel operacional interno da Simbora.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="bg-dark text-white antialiased">
        {/* Inline puro em vez de next/script: precisa rodar antes do paint pra
            evitar flash de tema, e o <Script beforeInteractive> quebra o
            render do RootLayout nessa versão do Next. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
