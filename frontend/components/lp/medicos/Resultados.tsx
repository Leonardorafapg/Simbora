const stats = [
  { value: "+120", label: "campanhas realizadas" },
  { value: "+50", label: "clientes atendidos" },
  { value: "98%", label: "satisfação" },
];

const testimonials = [
  {
    quote:
      "Em 3 meses meu Instagram saiu de 800 para 4.200 seguidores. Hoje recebo mensagens de pacientes novos toda semana.",
    name: "Dr. Carlos Mendes",
    role: "Clínico Geral, São Luís — MA",
  },
  {
    quote:
      "Os vídeos que a Simbora produziu me posicionaram como referência em harmonização facial na cidade.",
    name: "Dra. Ana Paula Reis",
    role: "Médica Estética, São Luís — MA",
  },
  {
    quote:
      "O tráfego pago trouxe pacientes qualificados para procedimentos de alto valor. ROI excelente.",
    name: "Dr. Roberto Lima",
    role: "Dermatologista, São Luís — MA",
  },
];

export default function Resultados() {
  return (
    <section className="bg-dark py-[100px] px-10 max-sm:py-14 max-sm:px-5">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-16 max-sm:mb-10">
          <span className="inline-block font-sans font-medium text-[0.8rem] tracking-[0.15em] uppercase text-cyan mb-4">
            Resultados
          </span>
          <h2 className="font-display-serif font-normal text-[3.2rem] max-sm:text-3xl text-white leading-[1.2]">
            Números que provam.
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-8 text-center mb-16 max-md:grid-cols-1 max-md:gap-10">
          {stats.map((stat, idx) => (
            <div key={idx}>
              <span className="block font-display-serif font-bold text-[4rem] text-cyan leading-none max-sm:text-[2.5rem]">
                {stat.value}
              </span>
              <span className="block font-sans font-normal text-[0.85rem] text-white/50 mt-2">
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6 max-md:grid-cols-1">
          {testimonials.map((item, idx) => (
            <div
              key={idx}
              className="bg-white/5 border border-white/8 rounded-xl p-7"
            >
              <p className="text-cyan mb-4">★★★★★</p>
              <p className="font-sans font-normal text-[0.95rem] text-white/70 leading-[1.7] mb-5">
                "{item.quote}"
              </p>
              <p className="font-display-serif font-bold text-base text-white">
                {item.name}
              </p>
              <p className="font-sans font-normal text-[0.8rem] text-white/40 mt-1">
                {item.role}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
