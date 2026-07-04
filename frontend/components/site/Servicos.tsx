"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

const services = [
  {
    id: "desenvolvimento",
    eyebrow: "Sites & Landing Pages",
    title: "Estrutura web veloz e focada em conversão.",
    description:
      "Desenvolvemos páginas de vendas (landing pages) e sites institucionais otimizados para carregar em menos de 2 segundos, com design totalmente responsivo e copywriting estratégico. O foco principal é reter o interesse do visitante e transformá-lo em lead qualificado, eliminando o desperdício de verba de tráfego.",
    image: "/images/landingpage-mockup.jpg",
  },
  {
    id: "trafego",
    eyebrow: "Tráfego Pago",
    title: "Campanhas inteligentes com foco em retorno de vendas (ROI).",
    description:
      "Planejamos, criamos e otimizamos diariamente campanhas no Meta Ads (Instagram/Facebook) e Google Ads (Pesquisa, YouTube e Display). Atraímos o público ideal com base em dados de comportamento e poder de compra, guiando os leads pelo funil para gerar vendas previsíveis e aumentar seu faturamento.",
    image: "/images/trafego-mockup.jpg",
  },
  {
    id: "socialmedia",
    eyebrow: "Social Media & Design",
    title: "Construção de autoridade e valor de marca nas redes.",
    description:
      "Desenvolvemos uma identidade visual premium consistente e uma linha editorial alinhada aos objetivos do seu negócio. Nossos designs estratégicos (como carrosséis educativos e posts de posicionamento) elevam o valor percebido da sua marca no digital, diferenciando sua empresa de concorrentes amadores.",
    image: "/images/socialmedia-mockup.jpg",
  },
  {
    id: "videos",
    eyebrow: "Criação de Vídeos",
    title: "Audiovisual de alto impacto para reter a atenção.",
    description:
      "Produzimos criativos em vídeo estruturados especificamente para venda e retenção rápida (Reels e TikTok). Entregamos roteiros estratégicos validados para você gravar sem complicação e fazemos a edição dinâmica com elementos visuais, legendas e sonorização profissional que geram desejo imediato pelo seu produto.",
    image: "/images/video-mockup.png",
  },
];

export default function Servicos() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const items = gsap.utils.toArray<HTMLElement>(".servico-item");

      items.forEach((item, i) => {
        const fromLeft = i % 2 === 0;
        gsap.fromTo(
          item,
          { opacity: 0, x: fromLeft ? -40 : 40 },
          {
            opacity: 1,
            x: 0,
            duration: 0.7,
            ease: "power2.out",
            scrollTrigger: {
              trigger: item,
              start: "top 85%",
            },
          }
        );
      });
    },
    { scope: containerRef }
  );

  return (
    <section
      ref={containerRef}
      id="servicos"
      className="relative z-[1] bg-gray-50 py-20 sm:py-32 px-6 lg:px-10"
    >
      <div className="max-w-[1200px] mx-auto">
        {/* Header da seção */}
        <div className="text-center mb-20 md:mb-28">
          <h2 className="font-sans font-bold text-4xl sm:text-5xl text-dark tracking-tight mb-4">
            Nossos Serviços
          </h2>
          <p className="font-sans font-normal text-base sm:text-lg text-gray-500 max-w-2xl mx-auto">
            Soluções completas de marketing digital sob medida para as necessidades do seu negócio.
          </p>
        </div>

        {/* Lista de serviços em Grid Alternado */}
        <div className="flex flex-col gap-8">
          {services.map((service, index) => {
            const isEven = index % 2 === 1;
            return (
              <div
                key={service.id}
                className={`servico-item group flex flex-col gap-10 md:gap-20 items-center w-full rounded-lg border border-gray-100 bg-white p-8 shadow-[0_4px_24px_rgba(0,0,0,0.05)] transition-shadow duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] md:p-12 ${
                  isEven ? "md:flex-row-reverse" : "md:flex-row"
                }`}
              >
                {/* Imagem do Serviço */}
                <div className="w-full md:w-1/2 aspect-[4/3] rounded-md overflow-hidden border border-gray-200 bg-white">
                  <img
                    src={service.image}
                    alt={service.eyebrow}
                    className="w-full h-full object-cover grayscale-[10%] transition-all duration-700 ease-out group-hover:grayscale-0 group-hover:scale-[1.03]"
                  />
                </div>

                {/* Conteúdo de Texto */}
                <div className="w-full md:w-1/2 flex flex-col items-start">
                  <div className="flex items-center gap-4 mb-6">
                    {/* Índice numérico */}
                    <span className="font-display-serif text-4xl text-gray-300 leading-none">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="h-px w-8 bg-gray-300" />
                    {/* Categoria/Título do Serviço */}
                    <h3 className="font-sans text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                      {service.eyebrow}
                    </h3>
                  </div>

                  {/* Parágrafo de descrição e headline */}
                  <p className="font-sans text-base text-gray-500 leading-[1.7]">
                    <strong className="font-display-serif font-normal text-dark block mb-3 text-2xl sm:text-3xl tracking-tight">
                      {service.title}
                    </strong>
                    <span className="font-light">
                      {service.description}
                    </span>
                  </p>

                  <a
                    href="#"
                    className="mt-6 inline-flex items-center gap-2 rounded-md border border-dark bg-gray-50 px-6 py-3 font-sans text-sm font-semibold text-dark shadow-[4px_4px_0px_0px_rgba(0,0,0,0.15)] transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.15)] active:translate-x-0 active:translate-y-0 active:shadow-[0px_0px_0px_0px_rgba(0,0,0,0.15)]"
                  >
                    Ver detalhes <span className="text-[10px]">→</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
