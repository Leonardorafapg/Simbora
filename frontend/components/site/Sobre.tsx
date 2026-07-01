"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

export default function Sobre() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const image = containerRef.current?.querySelector("#sobre-image");
      const text = containerRef.current?.querySelector("#sobre-text");

      if (image && text) {
        if (prefersReducedMotion) {
          gsap.set([image, text], { opacity: 1, x: 0 });
        } else {
          gsap.fromTo(
            image,
            { opacity: 0, x: -60 },
            {
              opacity: 1,
              x: 0,
              duration: 0.9,
              ease: "power3.out",
              scrollTrigger: { trigger: containerRef.current, start: "top 80%" },
            }
          );
          gsap.fromTo(
            text,
            { opacity: 0, x: 60 },
            {
              opacity: 1,
              x: 0,
              duration: 0.9,
              ease: "power3.out",
              scrollTrigger: { trigger: containerRef.current, start: "top 80%" },
            }
          );
        }
      }
    },
    { scope: containerRef }
  );

  return (
    <section ref={containerRef} id="sobre" className="relative z-[1] py-12 sm:py-24 bg-black">
      <div className="mx-auto grid grid-cols-1 max-w-7xl gap-12 px-6 lg:grid-cols-2 lg:items-center lg:px-10">
        <div
          id="sobre-image"
          className="flex h-72 items-center justify-center rounded-2xl bg-white/10 text-sm font-medium text-white/50 lg:h-96"
        >
          Foto do time
        </div>

        <div id="sobre-text">
          <p className="font-sans text-sm font-medium uppercase tracking-widest text-cyan">
            Sobre a Simbora
          </p>
          <h2 className="mt-4 font-sans text-3xl font-light leading-tight text-white sm:text-4xl">
            Uma agência do Maranhão feita pra transformar negócios locais.
          </h2>
          <p className="mt-6 font-sans text-base leading-relaxed text-white/80">
            Nascemos em São Luís com um propósito simples: ajudar negócios maranhenses a
            crescerem com estratégias de marketing que realmente funcionam para a nossa
            realidade. Unimos dados, criatividade e conhecimento local para entregar
            resultados consistentes, sem fórmulas genéricas importadas de outros mercados.
            Acreditamos que cada cliente tem uma história única — e é essa história que
            contamos em cada campanha.
          </p>
          <a href="#" className="mt-6 inline-block font-sans text-sm font-medium text-cyan underline">
            Conheça o time →
          </a>
        </div>
      </div>
    </section>
  );
}
