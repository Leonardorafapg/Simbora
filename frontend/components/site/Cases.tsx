"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

const cases = [
  {
    client: "Restaurante Sabor do Norte",
    metric: "+230% alcance em 60 dias",
  },
  {
    client: "Clínica Vida Plena",
    metric: "+180% agendamentos online",
  },
  {
    client: "Loja Maranhão Moda",
    metric: "+340% vendas via Instagram",
  },
];

export default function Cases() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const cards = gsap.utils.toArray(".case-card");

      if (prefersReducedMotion) {
        gsap.set(cards, { opacity: 1, x: 0 });
      } else {
        gsap.fromTo(
          cards,
          { opacity: 0, x: 60 },
          {
            opacity: 1,
            x: 0,
            duration: 0.8,
            ease: "power3.out",
            stagger: 0.15,
            scrollTrigger: {
              trigger: containerRef.current,
              start: "top 80%",
            },
          }
        );
      }
    },
    { scope: containerRef }
  );

  const scrollByCard = (direction: number) => {
    if (!trackRef.current) return;
    const card = trackRef.current.querySelector(".case-card") as HTMLElement;
    const amount = card ? card.clientWidth + 24 : 320;
    trackRef.current.scrollBy({ left: direction * amount, behavior: "smooth" });
  };

  return (
    <section ref={containerRef} id="cases" className="relative z-[1] py-12 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <h2 className="text-center font-sans text-3xl font-light text-white sm:text-4xl">
          Resultados que falam
        </h2>

        <div className="relative mt-16">
          <div
            ref={trackRef}
            id="cases-track"
            className="flex gap-6 overflow-x-auto scroll-smooth pb-4 no-scrollbar"
            style={{ scrollbarWidth: "none" }}
          >
            {cases.map((item, idx) => (
              <div
                key={idx}
                className="case-card flex min-w-[85%] flex-col gap-6 rounded-xl border border-cyan/15 bg-white/[0.03] p-6 sm:min-w-[60%] sm:flex-row lg:min-w-[45%]"
              >
                <div className="flex h-48 w-full items-center justify-center rounded-lg bg-white/10 text-sm font-medium text-white/50 sm:w-1/2">
                  Foto do case
                </div>
                <div className="flex flex-col justify-center sm:w-1/2">
                  <h3 className="font-sans text-xl font-light text-white">{item.client}</h3>
                  <p className="mt-2 font-sans text-base font-medium text-cyan">{item.metric}</p>
                  <a href="#" className="mt-6 font-sans text-sm font-medium text-cyan hover:underline">
                    Ver case completo →
                  </a>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center gap-4">
            <button
              onClick={() => scrollByCard(-1)}
              aria-label="Case anterior"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-cyan text-cyan transition-colors hover:bg-cyan hover:text-black"
            >
              ←
            </button>
            <button
              onClick={() => scrollByCard(1)}
              aria-label="Próximo case"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-cyan text-cyan transition-colors hover:bg-cyan hover:text-black"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
