"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

const cards = [
  {
    title: "Competência não vira reconhecimento sozinha",
    description:
      "Anos de prática e resultados consistentes não bastam para virar autoridade pública. Reconhecimento se constrói com visibilidade, não só com competência clínica.",
    icon: "trend",
  },
  {
    title: "Indicações de alto ticket passam batido",
    description:
      "Pacientes e outros médicos indicam quem lembram, não só quem é tecnicamente melhor. Sem presença digital, boas oportunidades acabam indo para quem aparece.",
    icon: "wallet",
  },
  {
    title: "Você é bom, mas invisível para quem não te conhece",
    description:
      "Seus pacientes já confiam em você. O problema é que fora do consultório, quase ninguém mais sabe que você existe.",
    icon: "eye",
  },
  {
    title: "Sua trajetória some com o tempo",
    description:
      "Sem registro digital da sua história, tudo que você já construiu não vira patrimônio de reputação. Fica só na memória de quem já é seu paciente.",
    icon: "clock",
  },
];

export default function CustoFicarParado() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const items = gsap.utils.toArray<HTMLElement>(".custo-parado-card");
      const tl = gsap.timeline({
        scrollTrigger: { trigger: containerRef.current, start: "top 80%" },
      });
      items.forEach((card, idx) => {
        const fromSide = idx % 2 === 0 ? -60 : 60;
        tl.fromTo(
          card,
          { opacity: 0, x: fromSide },
          { opacity: 1, x: 0, duration: 0.6, ease: "power2.out" },
          idx === 0 ? 0 : "-=0.05"
        );
      });
    },
    { scope: containerRef }
  );

  return (
    <section ref={containerRef} className="bg-white py-[100px] px-10 max-sm:py-14 max-sm:px-5">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-16 max-sm:mb-10">
          <span className="inline-block font-sans font-medium text-[0.8rem] tracking-[0.15em] uppercase text-cyan mb-4">
            O custo do reconhecimento não capturado
          </span>
          <h2 className="font-display-serif font-normal text-[3.2rem] max-sm:text-3xl text-dark leading-[1.2]">
            Ser bom e não aparecer também tem um preço.
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
          {cards.map((card, idx) => (
            <div
              key={idx}
              className="custo-parado-card opacity-0 bg-white border border-gray-200 rounded-xl p-9 max-sm:p-8 shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)]"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white text-dark mb-5 shadow-[0_2px_6px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] border border-gray-100">
                {card.icon === "trend" && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-6 w-6"
                  >
                    <path d="M3 3v18h18" />
                    <path d="M7 15l4-4 3 3 6-7" />
                    <path d="M16 7h4v4" />
                  </svg>
                )}
                {card.icon === "wallet" && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-6 w-6"
                  >
                    <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3" />
                    <path d="M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-4a2 2 0 0 0 0 4h5" />
                  </svg>
                )}
                {card.icon === "eye" && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-6 w-6"
                  >
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
                {card.icon === "clock" && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-6 w-6"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </svg>
                )}
              </div>
              <h3 className="font-display-serif font-bold text-[1.3rem] text-dark mb-3">
                {card.title}
              </h3>
              <p className="font-sans font-normal text-[0.95rem] text-gray-500 leading-[1.7]">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
