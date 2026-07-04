"use client";

const clientLogos = [
  { name: "Ferreiro Grill", logo: "/images/ferreiro-grill.png" },
  { name: "Ferreiro Prime", logo: "/images/ferreiro-prime.png" },
  { name: "Bistrô & Boteco", logo: "/images/bistro-boteco.png" },
  { name: "Ferreiro Praia", logo: "/images/ferreiro-praia.png" },
  { name: "Tasquinha Ferreiro", logo: "/images/tasquinha-ferreiro.png" },
  { name: "Honshu", logo: "/images/honshu.png" },
  { name: "Bicho Sadio", logo: "/images/bicho-sadio.png" },
  { name: "Bangalô Nordeste", logo: "/images/bangalo.png" },
  { name: "Arabian Grill", logo: "/images/arabian-grill.jpg" },
];

export default function Clientes() {
  // Duplicando exatamente duas vezes para um loop matemático perfeito de 0% a -50%
  const clientes = [...clientLogos, ...clientLogos];

  return (
    <section id="clientes" className="py-16 relative z-[1] border-y border-gray-100 bg-white overflow-hidden">
      <p className="text-center font-sans font-normal text-xs tracking-[0.2em] uppercase text-gray-400 mb-10 max-sm:mb-8">
        empresas que já cresceram com a simbora
      </p>

      {/* Wrapper externo */}
      <div className="w-full overflow-hidden select-none">
        {/* Container animado com gap reduzido em 25% (36px) e aceleração de hardware */}
        <div 
          className="animate-marquee flex w-max items-center gap-[36px] will-change-transform"
          style={{ transform: "translate3d(0,0,0)" }}
        >
          {clientes.map((cliente, i) => (
            <div
              key={i}
              className="flex-shrink-0 h-36 w-[330px] flex items-center justify-center p-3"
            >
              <img
                src={cliente.logo}
                alt={cliente.name}
                className="max-h-full max-w-full object-contain opacity-95"
                style={{ 
                  transform: "translate3d(0,0,0)",
                  backfaceVisibility: "hidden",
                  imageRendering: "auto"
                }}
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
