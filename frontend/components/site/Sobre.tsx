"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import type { CarouselApi } from "@/components/ui/carousel";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";

gsap.registerPlugin(ScrollTrigger);

const sobreFotos = [
  "/images/sobre/foto-1.png",
  "/images/sobre/foto-2.png",
  "/images/sobre/foto-3.png",
  "/images/sobre/foto-4.png",
];

export default function Sobre() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => setCurrent(api.selectedScrollSnap()));
  }, [api]);

  useGSAP(
    () => {
      const image = containerRef.current?.querySelector("#sobre-image");
      const text = containerRef.current?.querySelector("#sobre-text");

      if (image && text) {
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
    },
    { scope: containerRef }
  );

  return (
    <section ref={containerRef} id="sobre" className="relative z-[1] bg-gray-50 py-16 sm:py-28">
      <div className="mx-auto grid grid-cols-1 max-w-7xl gap-12 px-6 lg:grid-cols-2 lg:items-center lg:px-10">
        <div id="sobre-image">
          <div className="relative">
            {/* Páginas empilhadas atrás da foto ativa */}
            <div className="absolute inset-0 rounded-md border border-gray-200 bg-white rotate-2 translate-x-3 translate-y-3" />
            <div className="absolute inset-0 rounded-md border border-gray-200 bg-white rotate-1 translate-x-1.5 translate-y-1.5" />

            <Carousel opts={{ loop: true }} setApi={setApi} className="relative w-full">
              <CarouselContent>
                {sobreFotos.map((src, i) => (
                  <CarouselItem key={src}>
                    <div className="h-72 w-full overflow-hidden rounded-md border border-gray-200 bg-gray-50 lg:h-96">
                      <img
                        src={src}
                        alt={`Simbora — foto ${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>

          {/* Paginação animada */}
          <div className="mt-6 flex items-center justify-center gap-2">
            {sobreFotos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => api?.scrollTo(i)}
                aria-label={`Ir para a foto ${i + 1}`}
                className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                  current === i ? "bg-dark" : "bg-gray-300 hover:bg-gray-400"
                }`}
              />
            ))}
          </div>
        </div>

        <div id="sobre-text">
          <p className="font-sans text-xs font-medium uppercase tracking-[0.2em] text-cyan">
            Sobre a Simbora
          </p>
          <h2 className="mt-4 font-sans text-3xl sm:text-5xl font-normal leading-[1.15] text-dark">
            Uma agência do Maranhão feita pra transformar negócios locais.
          </h2>
          <p className="mt-6 font-sans font-light text-base leading-relaxed text-gray-500">
            Nascemos in São Luís com um propósito simples: ajudar negócios maranhenses a
            crescerem com estratégias de marketing que realmente funcionam para a nossa
            realidade. Unimos dados, criatividade e conhecimento local para entregar
            resultados consistentes, sem fórmulas genéricas importadas de outros mercados.
            Acreditamos que cada cliente tem uma história única — e é essa história que
            contamos em cada campanha.
          </p>
          <a href="#" className="mt-6 inline-flex items-center gap-1 font-sans text-sm font-medium text-cyan/85 hover:text-cyan transition-colors duration-200 hover:underline">
            Conheça o time <span className="text-[10px]">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
