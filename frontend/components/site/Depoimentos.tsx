"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

const depoimentos = [
  {
    name: "Carla Mendes",
    role: "Dona de restaurante, São Luís",
    quote:
      "Desde que a Simbora assumiu nossas redes, o movimento no salão cresceu visivelmente. Hoje fechamos a semana com a agenda cheia.",
  },
  {
    name: "Ricardo Almeida",
    role: "Dono de clínica, São Luís",
    quote:
      "O tráfego pago trouxe pacientes novos todos os meses. A equipe entende muito bem o público maranhense.",
  },
  {
    name: "Juliana Costa",
    role: "Empreendedora, Imperatriz",
    quote:
      "Os vídeos produzidos pela Simbora elevaram o nível da nossa marca. Recebemos elogios constantes dos clientes.",
  },
];

export default function Depoimentos() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const cards = gsap.utils.toArray(".depoimento-card");

      if (prefersReducedMotion) {
        gsap.set(cards, { opacity: 1, y: 0 });
      } else {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
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

  return (
    <section ref={containerRef} id="depoimentos" className="relative z-[1] py-12 sm:py-24 bg-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <h2 className="text-center font-sans text-3xl font-light text-black sm:text-4xl">
          O que nossos clientes dizem
        </h2>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {depoimentos.map((item, idx) => (
            <div
              key={idx}
              className="depoimento-card rounded-xl border border-[#E5E5E5] bg-white p-8 shadow-[0_4px_24px_rgba(0,0,0,0.08)] transition-shadow duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.14)]"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-gray-300"></div>
                <div>
                  <p className="font-sans text-base font-semibold text-black">{item.name}</p>
                  <p className="font-sans text-xs text-black/60">{item.role}</p>
                </div>
              </div>
              <p className="mt-3 text-cyan">★★★★★</p>
              <p className="mt-4 font-sans text-sm leading-relaxed text-black/80">
                "{item.quote}"
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
