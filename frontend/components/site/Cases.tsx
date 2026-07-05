"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

function ChartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}

function CameraIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function LayersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function PlayIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" />
    </svg>
  );
}

const categories = ["Todos", "Campanhas", "Fotografia", "Design", "Vídeo"] as const;
type Category = (typeof categories)[number];

const categoryIcons: Record<Exclude<Category, "Todos">, (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element> = {
  Campanhas: ChartIcon,
  Fotografia: CameraIcon,
  Design: LayersIcon,
  Vídeo: PlayIcon,
};

type PortfolioItem =
  | {
      id: number;
      category: "Campanhas";
      size: "large" | "small";
      client: string;
      metric: string;
      metricLabel: string;
    }
  | {
      id: number;
      category: Exclude<Category, "Todos" | "Campanhas">;
      size: "large" | "small";
      title: string;
      detail: string;
      /** Caminhos em /public para as imagens (Fotografia/Design) ou vídeo (Vídeo) do case. Pode ter mais de uma imagem agrupada. */
      media?: string[];
    };

const portfolioItems: PortfolioItem[] = [
  { id: 1, category: "Campanhas", size: "large", client: "Restaurante Sabor do Norte", metric: "+230%", metricLabel: "alcance em 60 dias" },
  {
    id: 2,
    category: "Fotografia",
    size: "large",
    title: "Cobertura de evento",
    detail: "Fotografia de cobertura ao vivo",
    media: [
      "/images/cases/cobertura-evento-transporte-universitario.jpg",
      "/images/cases/cobertura-evento-autoridades.jpg",
    ],
  },
  { id: 3, category: "Fotografia", size: "small", title: "EHô Cerâmica", detail: "Still de produto", media: ["/images/cases/produto-eho-ceramica.jpg"] },
  { id: 4, category: "Campanhas", size: "small", client: "Loja Maranhão Moda", metric: "+340%", metricLabel: "vendas via Instagram" },
  {
    id: 5,
    category: "Fotografia",
    size: "small",
    title: "Gastronomia",
    detail: "Still gastronômico",
    media: [
      "/images/cases/gastronomia-petiscos-fritos.jpg",
      "/images/cases/gastronomia-camarao-frito.jpg",
      "/images/cases/gastronomia-honshu-sushi.jpg",
      "/images/cases/still-chopp-artesanal.jpg",
    ],
  },
  { id: 6, category: "Fotografia", size: "small", title: "Bio Mundo", detail: "Fotografia comercial", media: ["/images/cases/comercial-bio-mundo.jpg"] },
  { id: 7, category: "Design", size: "small", title: "HNT Cardápio", detail: "Peça de cardápio/promoção", media: ["/images/cases/design-hnt-cardapio.jpg"] },
  { id: 8, category: "Design", size: "small", title: "Cadê Meu Doce", detail: "Arte para Stories", media: ["/images/cases/design-stories-cade-meu-doce.png"] },
];

export default function Cases() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState<Category>("Todos");
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  const filtered =
    activeCategory === "Todos"
      ? portfolioItems
      : portfolioItems.filter((item) => item.category === activeCategory);

  useGSAP(
    () => {
      const cards = gsap.utils.toArray<HTMLElement>(".portfolio-card");

      cards.forEach((card) => {
        gsap.fromTo(
          card,
          { opacity: 0, y: 32 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: "power2.out",
            scrollTrigger: {
              trigger: card,
              start: "top 90%",
            },
          }
        );
      });
    },
    { scope: containerRef, dependencies: [activeCategory] }
  );

  return (
    <section ref={containerRef} id="cases" className="relative z-[1] bg-white py-20 sm:py-32 px-6 lg:px-10">
      <div className="max-w-[1200px] mx-auto">
        {/* Header da seção */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-14">
          <div>
            <span className="block font-sans text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 mb-4">
              Portfólio
            </span>
            <h2 className="font-display-serif text-4xl sm:text-6xl font-normal text-dark tracking-tight">
              Nosso Trabalho
            </h2>
          </div>
          <p className="font-sans text-gray-500 max-w-md leading-relaxed">
            Uma seleção de campanhas, fotos, designs e vídeos que já colocamos em prática para os nossos clientes.
          </p>
        </div>

        {/* Filtro de categorias */}
        <div className="flex flex-wrap gap-3 mb-12">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2 text-xs sm:text-sm font-semibold uppercase tracking-wide border transition-colors duration-200 ${
                activeCategory === cat
                  ? "bg-dark text-white border-dark"
                  : "border-gray-200 text-gray-500 hover:border-dark hover:text-dark"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid de trabalhos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item) => {
            const isLarge = item.size === "large";

            if (item.category === "Campanhas") {
              return (
                <div
                  key={item.id}
                  className={`portfolio-card relative flex flex-col justify-between overflow-hidden rounded-md border border-gray-200 bg-dark p-8 min-h-[280px] ${
                    isLarge ? "sm:col-span-2" : ""
                  }`}
                >
                  <ChartIcon className="h-6 w-6 text-white/40" />
                  <div>
                    <div className="font-display-serif text-5xl sm:text-6xl text-white tracking-tight mb-3">
                      {item.metric}
                    </div>
                    <p className="font-sans text-sm text-white/60 uppercase tracking-wide mb-1">
                      {item.metricLabel}
                    </p>
                    <p className="font-sans text-base text-white/90">{item.client}</p>
                  </div>
                </div>
              );
            }

            const Icon = categoryIcons[item.category];
            const isVideo = item.category === "Vídeo";
            const firstMedia = item.media?.[0];

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (item.media && !isVideo) setLightbox({ images: item.media, index: 0 });
                }}
                className={`portfolio-card group relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50 min-h-[280px] shadow-[0_2px_4px_rgba(0,0,0,0.04),0_12px_24px_-8px_rgba(0,0,0,0.12)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.06),0_28px_48px_-12px_rgba(0,0,0,0.22)] ${
                  item.media && !isVideo ? "cursor-pointer" : ""
                } ${isLarge ? "sm:col-span-2" : ""}`}
              >
                {isVideo && firstMedia ? (
                  <video
                    src={firstMedia}
                    className="absolute inset-0 h-full w-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                ) : firstMedia ? (
                  <Image
                    src={firstMedia}
                    alt={item.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50">
                    <Icon className="h-10 w-10 text-gray-300" />
                  </div>
                )}
                {item.media && item.media.length > 1 && (
                  <span className="absolute top-4 right-4 rounded-full bg-black/60 text-white text-xs font-sans font-semibold px-2.5 py-1">
                    +{item.media.length - 1}
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/75 to-transparent p-6 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                  <span className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                    {item.category}
                  </span>
                  <h3 className="font-display-serif text-xl text-white mt-1">{item.title}</h3>
                  <p className="font-sans text-sm text-white/70">{item.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-6 right-6 text-white/70 hover:text-white text-3xl leading-none"
            aria-label="Fechar"
          >
            &times;
          </button>

          {lightbox.images.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox((prev) =>
                  prev
                    ? { ...prev, index: (prev.index - 1 + prev.images.length) % prev.images.length }
                    : prev
                );
              }}
              className="absolute left-4 sm:left-8 text-white/70 hover:text-white text-4xl leading-none"
              aria-label="Anterior"
            >
              ‹
            </button>
          )}

          <div
            className="relative w-full max-w-4xl h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={lightbox.images[lightbox.index]}
              alt=""
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>

          {lightbox.images.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox((prev) =>
                  prev ? { ...prev, index: (prev.index + 1) % prev.images.length } : prev
                );
              }}
              className="absolute right-4 sm:right-8 text-white/70 hover:text-white text-4xl leading-none"
              aria-label="Próxima"
            >
              ›
            </button>
          )}
        </div>
      )}
    </section>
  );
}
