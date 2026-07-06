"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

const nichos = ["Restaurantes.", "Lojas.", "Médicos.", "Empresas Locais."];

export default function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nichoIndex, setNichoIndex] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    let switchTimeout: ReturnType<typeof setTimeout>;
    const interval = setInterval(() => {
      setPhase("out");
      switchTimeout = setTimeout(() => {
        setNichoIndex((prev) => (prev + 1) % nichos.length);
        setPhase("in");
      }, 768);
    }, 4352);

    return () => {
      clearInterval(interval);
      clearTimeout(switchTimeout);
    };
  }, []);

  useGSAP(
    () => {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!prefersReducedMotion) {
        const tl = gsap.timeline();
        tl.fromTo(
          ".hero-fade-in",
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power2.out",
          }
        );
      } else {
        gsap.set(".hero-fade-in", { opacity: 1, y: 0 });
      }
    },
    { scope: containerRef }
  );

  return (
    <section
      ref={containerRef}
      id="hero"
      className="relative z-[1] w-full overflow-hidden bg-white pt-[calc(10rem+80px)] pb-24 md:pt-[calc(14rem+80px)] md:pb-32"
    >
      {/* Banner de fundo */}
      <img
        src="/images/simbora-illustration.png"
        alt="Simbora Maranhão — marketing para restaurantes, médicos, clínicas e lojas"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />

      {/* Overlay claro pra garantir contraste do texto sobre o banner */}
      <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-white/40"></div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-10 w-full">
        <div className="hero-fade-in opacity-0 max-w-6xl">
          <h1 className="font-sans font-bold text-6xl md:text-8xl lg:text-[7rem] tracking-tighter leading-[0.9] text-dark">
            Agência de Marketing <br />
            e Publicidade para <br />
            <span className="inline-block relative min-w-[350px]">
              <span
                key={nichoIndex}
                className={`absolute left-0 text-cyan font-bold ${
                  phase === "out" ? "animate-rotate-word-out" : "animate-rotate-word-in"
                }`}
              >
                {nichos[nichoIndex]}
              </span>
              {/* spacer invisível com a maior palavra da lista, pra reservar espaço e não pular layout */}
              <span className="invisible">Empresas Locais.</span>
            </span>
          </h1>
        </div>
      </div>
    </section>
  );
}
