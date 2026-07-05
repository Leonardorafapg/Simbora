"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

const faqs = [
  {
    question: "Como funciona o planejamento gratuito?",
    answer:
      "Você fala com a gente no WhatsApp, conta sua especialidade e seus objetivos, e nossa equipe monta um planejamento personalizado para o seu caso, sem custo algum.",
  },
  {
    question: "Preciso pagar alguma coisa para receber o planejamento?",
    answer:
      "Não. O planejamento inicial é gratuito e sem compromisso. Você só decide se quer seguir com a assessoria depois de ver a proposta completa.",
  },
  {
    question: "Quanto tempo demora para eu receber uma resposta?",
    answer:
      "Nosso time responde rapidamente pelo WhatsApp e agenda o envio do seu planejamento assim que confirma sua especialidade e seus objetivos.",
  },
  {
    question: "Já tenho pacientes, por que eu precisaria disso?",
    answer:
      "Ter pacientes não é o mesmo que ter reconhecimento. Mesmo com a agenda cheia hoje, a falta de presença digital trava indicações de alto ticket, convites e o reconhecimento que sua competência já merece.",
  },
  {
    question: "Atendem médicos de qualquer especialidade?",
    answer:
      "Sim. Atendemos clínicos gerais, especialistas, médicos estéticos, dentistas e outros profissionais de saúde em todo o Maranhão.",
  },
];

export default function FAQ() {
  const containerRef = useRef<HTMLElement>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  useGSAP(
    () => {
      gsap.fromTo(
        ".faq-fade-in",
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
      <div className="max-w-[760px] mx-auto">
        <h2 className="faq-fade-in opacity-0 font-display-serif font-normal text-[2.5rem] max-sm:text-3xl text-dark mb-12">
          Perguntas frequentes.
        </h2>

        <div className="faq-fade-in opacity-0 border-t border-gray-200">
          {faqs.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={idx} className="border-b border-gray-200 py-6">
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full bg-none border-none cursor-pointer flex justify-between items-center text-left font-sans font-medium text-base text-dark p-0"
                >
                  <span>{item.question}</span>
                  <span
                    className="text-cyan text-xl flex-shrink-0 ml-4 transition-transform duration-300"
                    style={{ transform: isOpen ? "rotate(135deg)" : "none" }}
                  >
                    +
                  </span>
                </button>
                <div
                  className="transition-all duration-300 ease-in-out overflow-hidden"
                  style={{
                    maxHeight: isOpen ? "200px" : "0px",
                  }}
                >
                  <p className="font-sans font-normal text-[0.95rem] text-gray-500 leading-[1.7] pt-4">
                    {item.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
