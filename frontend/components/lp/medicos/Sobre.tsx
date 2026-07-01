export default function Sobre() {
  return (
    <section className="bg-[#f9fafb] py-[100px] px-10 max-sm:py-14 max-sm:px-5">
      <div className="max-w-[900px] mx-auto text-center">
        <span className="inline-block font-sans font-medium text-[0.8rem] tracking-[0.15em] uppercase text-cyan mb-4">
          Quem somos
        </span>
        <h2 className="font-display-serif font-normal text-[2.8rem] max-sm:text-3xl text-dark leading-[1.2] mb-6">
          Uma agência do Maranhão<br />
          especializada em saúde digital.
        </h2>
        <p className="font-sans font-normal text-base text-gray-500 leading-[1.8]">
          A Simbora nasceu em São Luís com uma missão: transformar profissionais de saúde em
          referências digitais. Combinamos estratégia, criatividade e tecnologia para construir
          autoridade real — não apenas seguidores.
        </p>

        <div className="w-full max-w-[700px] h-[320px] max-sm:h-[220px] bg-gray-200 rounded-2xl mt-10 max-sm:mt-7 mx-auto flex items-center justify-center font-sans font-normal text-[0.8rem] text-gray-400">
          [ foto do time ]
        </div>
      </div>
    </section>
  );
}
