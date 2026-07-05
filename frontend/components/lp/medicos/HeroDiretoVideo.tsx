"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export default function HeroDiretoVideo() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.fromTo(
        ".hero-fade-in",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }
      );
    },
    { scope: containerRef }
  );

  return (
    <section ref={containerRef} className="bg-white py-10 px-10 pb-20 max-sm:py-6 max-sm:px-5 max-sm:pb-15 max-w-7xl mx-auto">
      {/* Logo - linha própria, full width, fora do grid de colunas */}
      <div className="hero-fade-in opacity-0 mb-8 max-sm:mb-6 max-sm:flex max-sm:justify-center">
        <img
          src="/images/logo.png"
          alt="Simbora Maranhão"
          style={{
            height: "36px",
            maxHeight: "36px",
            width: "auto",
            maxWidth: "160px",
            display: "block",
            objectFit: "contain",
          }}
        />
      </div>

      {/* Headline principal - linha única, full width, acima do grid */}
      <h1 className="hero-fade-in opacity-0 font-display-serif font-bold text-3xl sm:text-4xl md:text-[2.6rem] leading-[1.15] text-dark text-center whitespace-nowrap mb-4 max-sm:whitespace-normal max-sm:text-2xl">
        Sua reputação precisa existir também fora do consultório.
      </h1>

      {/* Subheadline principal - abaixo da headline, acima do grid */}
      <p className="hero-fade-in opacity-0 font-sans font-normal text-lg text-gray-500 text-center max-w-2xl mx-auto mb-10">
        Hoje, muitos pacientes pesquisam antes de marcar uma consulta. O que
        eles encontram sobre você?
      </p>

      {/* Grid Layout: 2 colunas no desktop, centralizadas como um par */}
      <div className="hero-fade-in opacity-0 grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8 items-center w-full">

        {/* Coluna da Direita (Títulos e CTA) - Ocupa 6 colunas */}
        <div className="md:col-span-6 order-2 flex flex-col items-center text-center w-full">
          {/* Subheadline - máx 2 linhas e fonte ajustada */}
          <h2 className="font-display-serif font-normal text-[2rem] leading-[1.15] text-dark mb-4 max-sm:text-[1.5rem] w-full">
            Fale com nosso time e receba um planejamento personalizado!
          </h2>

          {/* Descrição */}
          <p className="font-sans font-normal text-[1.1rem] text-gray-500 leading-[1.7] mb-7 mx-auto">
            Clique no botão abaixo agora e fale direto com o nosso time no
            WhatsApp. Vamos entender seu momento e te entregar, TOTALMENTE DE
            GRAÇA, um planejamento personalizado de posicionamento digital
            feito especialmente pra sua especialidade.
          </p>

          {/* CTA e Info Adicional */}
          <div className="w-full flex flex-col items-center">
            <a
              href="https://wa.me/5598999999999?text=Quero%20verificar%20a%20disponibilidade%20de%20vaga%20da%20minha%20especialidade"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-fit cursor-pointer text-center bg-cyan text-black font-sans font-semibold text-lg py-5 px-14 rounded-lg no-underline shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_-1px_0_rgba(0,0,0,0.15)_inset,0_4px_20px_rgba(0,200,200,0.25)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_-1px_0_rgba(0,0,0,0.15)_inset,0_8px_28px_rgba(0,200,200,0.35)] active:translate-y-px active:shadow-[0_1px_4px_rgba(0,0,0,0.15)] max-sm:w-full max-sm:max-w-[480px] max-sm:py-4 max-sm:px-6"
            >
              Falar com a Simbora no WhatsApp
            </a>
            <p className="font-sans font-normal text-[0.8rem] text-gray-400 mt-3 text-center">
              Sem contrato de fidelidade. Resultado em 90 dias.
            </p>
          </div>
        </div>

        {/* Coluna da Esquerda (Vídeo) - Ocupa 6 colunas e alinha com a logo/headline */}
        <div className="md:col-span-6 order-1 w-full flex items-center justify-center md:pt-4">
          <div className="w-full aspect-video bg-gray-100 rounded-md border border-gray-200 flex items-center justify-center shadow-md">
            <div className="flex flex-col items-center gap-3">
              <span className="text-cyan text-[3rem] cursor-pointer hover:scale-105 transition-transform">▶</span>
              <span className="font-sans font-normal text-[0.9rem] text-gray-400 text-center px-4">
                Vídeo de apresentação
              </span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
