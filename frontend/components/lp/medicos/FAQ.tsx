"use client";

import { useState } from "react";

const faqs = [
  {
    question: "Quanto tempo para ver resultados?",
    answer:
      "Os primeiros resultados em engajamento e alcance aparecem entre 30 e 60 dias. Autoridade consolidada e crescimento consistente ocorrem a partir do 90º dia.",
  },
  {
    question: "Preciso aparecer nos vídeos?",
    answer:
      "Sim, para construir autoridade médica real o rosto do profissional é essencial. Mas trabalhamos todo o roteiro e direção para que você se sinta confortável na frente da câmera.",
  },
  {
    question: "Tem contrato de fidelidade?",
    answer:
      "Não. Trabalhamos com recorrência mensal sem fidelidade mínima. Acreditamos que resultado é o que mantém o cliente.",
  },
  {
    question: "Como funciona a produção de conteúdo?",
    answer:
      "Nossa equipe cria o planejamento, roteiros, artes e legendas. Você revisa e aprova antes de qualquer publicação. Sua identidade e ética médica são sempre preservadas.",
  },
  {
    question: "Atendem médicos de qualquer especialidade?",
    answer:
      "Sim. Atendemos clínicos gerais, especialistas, médicos estéticos, dentistas e outros profissionais de saúde em todo o Maranhão.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="bg-white py-[100px] px-10 max-sm:py-14 max-sm:px-5">
      <div className="max-w-[760px] mx-auto">
        <h2 className="font-display-serif font-normal text-[2.5rem] max-sm:text-3xl text-dark mb-12">
          Perguntas frequentes.
        </h2>

        <div className="border-t border-gray-200">
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
