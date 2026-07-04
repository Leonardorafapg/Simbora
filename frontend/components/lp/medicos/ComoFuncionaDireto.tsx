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
    title: "Confirmamos sua vaga exclusiva",
    description:
      "Trabalhamos com 1 médico por especialidade/região, garantindo posicionamento sem concorrência direta.",
  },
  {
    title: "Agendamos sua call de diagnóstico",
    description:
      "Alinhamos o plano completo e você começa a gravar cerca de 2h por mês — o resto é com a gente.",
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
    <section ref={containerRef} className="bg-[#f9fafb] py-[100px] px-10 max-sm:py-14 max-sm:px-5">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-16 max-sm:mb-10">
          <span className="inline-block font-sans font-medium text-[0.8rem] tracking-[0.15em] uppercase text-cyan mb-4">
            Como funciona
          </span>
          <h2 className="font-sans font-normal text-[3.2rem] max-sm:text-3xl text-dark leading-[1.2]">
            Do primeiro contato à sua vaga garantida.
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-8 max-md:grid-cols-1">
          {steps.map((step, idx) => (
            <div
              key={idx}
              className="como-funciona-direto-step opacity-0 bg-white border border-gray-200 rounded-md p-8"
            >
              <span className="font-sans text-4xl text-gray-300 leading-none">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-4 font-sans font-bold text-[1.2rem] text-dark mb-2">
                {step.title}
              </h3>
              <p className="font-sans text-[0.95rem] text-gray-500 leading-[1.7]">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
