"use client";

import { useState } from "react";

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
  },
];

export default function Servicos() {
  const [activeTab, setActiveTab] = useState(services[0]);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleTabChange = (tab: typeof services[0]) => {
    if (tab.id === activeTab.id) return;
    setIsTransitioning(true);

    setTimeout(() => {
      setActiveTab(tab);
      setIsTransitioning(false);
    }, 200);
  };

  return (
    <section id="servicos" className="relative z-[1] py-[120px] px-10 max-sm:py-20 max-sm:px-5">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex justify-center flex-wrap gap-4">
          {services.map((tab) => {
            const isActive = activeTab.id === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab)}
                className={`font-serif text-[0.95rem] py-2.5 px-7 rounded-lg border cursor-pointer transition-all duration-200 hover:-translate-y-px active:translate-y-px ${
                  isActive
                    ? "bg-cyan border-cyan text-black font-bold shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_-1px_0_rgba(0,0,0,0.3)_inset,0_4px_20px_rgba(0,200,200,0.25)]"
                    : "border-white/15 bg-transparent text-white/50 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_-1px_0_rgba(0,0,0,0.4)_inset,0_4px_16px_rgba(0,0,0,0.4)] hover:bg-cyan/10 hover:border-cyan/30 hover:text-white hover:shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_-1px_0_rgba(0,0,0,0.4)_inset,0_8px_24px_rgba(0,0,0,0.5)]"
                }`}
              >
                {tab.eyebrow}
              </button>
            );
          })}
        </div>

        <div
          className={`mt-12 w-full bg-white/5 rounded-2xl overflow-hidden flex flex-col md:flex-row transition-opacity duration-300 ${
            isTransitioning ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="md:flex-[0_0_60%] relative min-h-[420px] bg-white/5 flex items-center justify-center overflow-hidden">
            {activeTab.image ? (
              <img
                src={activeTab.image}
                alt={activeTab.title}
                className="absolute inset-0 w-full h-full object-cover object-center transition-all duration-500 hover:scale-[1.03]"
              />
            ) : (
              <span className="text-white/20 text-xs tracking-[0.15em] uppercase">
                [ imagem ]
              </span>
            )}
          </div>
          <div className="md:flex-[0_0_40%] p-12 max-sm:p-8 flex flex-col justify-center">
            <span className="inline-block w-fit bg-cyan/10 border border-cyan/20 text-cyan text-[0.75rem] tracking-[0.2em] uppercase py-1.5 px-4 rounded-full mb-6">
              {activeTab.eyebrow}
            </span>
            <h3 className="font-display-serif font-normal text-[2.8rem] max-sm:text-3xl text-white leading-[1.1] mb-5">
              {activeTab.title}
            </h3>
            <p className="font-display-serif font-normal text-base text-white/60 leading-[1.8]">
              {activeTab.description}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
