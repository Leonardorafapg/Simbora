"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    title: "Fala com a gente no WhatsApp",
    description:
      "Conta sua especialidade e o que busca: migrar pro particular, ganhar tempo ou virar referência na região.",
  },
  {
    title: "Agendamos o envio do seu planejamento",
    description:
      "Nossa equipe monta seu planejamento personalizado e agenda o envio direto pra você, sem enrolação.",
  },
];

export default function ComoFuncionaDireto() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const items = gsap.utils.toArray<HTMLElement>(".como-funciona-direto-step");
      gsap.fromTo(
        items,
        { opacity: 0, y: 32 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: "power2.out",
          stagger: 0.12,
          scrollTrigger: { trigger: containerRef.current, start: "top 80%" },
        }
      );
    },
    { scope: containerRef }
  );

  return (
    <section ref={containerRef} className="bg-[#f9fafb] py-14 px-10 max-sm:py-10 max-sm:px-5">
      <div className="max-w-[1000px] mx-auto">
        <div className="text-center mb-10 max-sm:mb-8">
          <span className="inline-block font-sans font-medium text-[0.75rem] tracking-[0.15em] uppercase text-cyan mb-3">
            Como funciona
          </span>
          <h2 className="font-sans font-normal text-[2rem] max-sm:text-2xl text-dark leading-[1.2]">
            Do primeiro contato à sua vaga garantida.
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            return (
              <div
                key={idx}
                className="como-funciona-direto-step opacity-0 bg-white border border-gray-200 rounded-md p-5"
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="font-sans text-2xl text-gray-300 leading-none">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-sans font-bold text-base text-dark">
                    {step.title}
                  </h3>
                </div>
                <p className="font-sans text-[0.85rem] text-gray-500 leading-[1.6]">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
