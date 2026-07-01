const cards = [
  {
    title: "Gestão de Redes Sociais",
    description:
      "Postagens diárias estratégicas no Instagram com identidade visual consistente e linguagem médica adequada.",
    icon: "smartphone",
  },
  {
    title: "Tráfego Pago",
    description:
      "Anúncios no Meta e Google direcionados para pacientes na sua região e especialidade.",
    icon: "chart",
  },
  {
    title: "Produção de Vídeos",
    description:
      "Vídeos curtos e reels que posicionam você como autoridade e geram alcance orgânico.",
    icon: "video",
  },
  {
    title: "Relatório Mensal",
    description:
      "Acompanhamento completo de métricas, crescimento e resultados de cada ação realizada.",
    icon: "document",
  },
];

export default function Entregaveis() {
  return (
    <section className="bg-white py-[100px] px-10 max-sm:py-14 max-sm:px-5">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-16 max-sm:mb-10">
          <span className="inline-block font-sans font-medium text-[0.8rem] tracking-[0.15em] uppercase text-cyan mb-4">
            O que você recebe
          </span>
          <h2 className="font-display-serif font-normal text-[3.2rem] max-sm:text-3xl text-dark leading-[1.2]">
            Tudo que sua presença digital precisa.
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
          {cards.map((card, idx) => (
            <div
              key={idx}
              className="bg-[#f9fafb] border border-gray-200 rounded-xl p-9 max-sm:p-8 transition-all duration-300 hover:border-cyan hover:shadow-[0_12px_32px_rgba(0,0,0,0.06)]"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-cyan/10 text-cyan mb-5">
                {card.icon === "smartphone" && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-6 w-6"
                  >
                    <rect x="6" y="2" width="12" height="20" rx="2" />
                    <line x1="11" y1="18" x2="13" y2="18" />
                  </svg>
                )}
                {card.icon === "chart" && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-6 w-6"
                  >
                    <path d="M3 3v18h18" />
                    <path d="M7 15l4-4 3 3 6-7" />
                    <path d="M16 7h4v4" />
                  </svg>
                )}
                {card.icon === "video" && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-6 w-6"
                  >
                    <rect x="3" y="5" width="13" height="14" rx="2" />
                    <path d="M16 9.5l5-3v11l-5-3z" />
                  </svg>
                )}
                {card.icon === "document" && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-6 w-6"
                  >
                    <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
                    <path d="M14 3v4h4" />
                    <path d="M8 13l2 2 4-5" />
                  </svg>
                )}
              </div>
              <h3 className="font-display-serif font-bold text-[1.3rem] text-dark mb-3">
                {card.title}
              </h3>
              <p className="font-sans font-normal text-[0.95rem] text-gray-500 leading-[1.7]">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
