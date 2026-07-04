"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

export default function PorQueGratis() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.fromTo(
        ".por-que-gratis-fade",
        { opacity: 0, y: 28 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power2.out",
          scrollTrigger: { trigger: containerRef.current, start: "top 80%" },
        }
      );
    },
    { scope: containerRef }
  );

  return (
    <section ref={containerRef} className="bg-white py-[100px] px-10 max-sm:py-14 max-sm:px-5">
      <div className="max-w-[760px] mx-auto text-center">
        <span className="por-que-gratis-fade opacity-0 inline-block font-sans font-medium text-[0.8rem] tracking-[0.15em] uppercase text-cyan mb-4">
          Por que é gratuito?
        </span>
        <h2 className="por-que-gratis-fade opacity-0 font-sans font-normal text-[2.5rem] max-sm:text-3xl text-dark leading-[1.2] mb-6">
          Preferimos provar valor antes de pedir qualquer compromisso.
        </h2>
        <p className="por-que-gratis-fade opacity-0 font-sans font-normal text-base text-gray-500 leading-[1.8]">
          Sabemos que muitos médicos já pagaram por posts bonitos que não trouxeram nenhum paciente
          novo. Por isso, antes de falar em contrato, mostramos exatamente onde seu perfil está
          perdendo autoridade e pacientes particulares — sem custo, sem letra miúda. Se fizer sentido
          pra você, seguimos pra uma conversa rápida de 15 minutos pra montar seu plano.
        </p>
      </div>
    </section>
  );
}
