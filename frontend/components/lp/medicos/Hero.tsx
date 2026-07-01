export default function Hero() {
  return (
    <section className="bg-white py-10 px-10 pb-20 max-sm:py-6 max-sm:px-5 max-sm:pb-15">
      <div className="flex flex-col gap-4 items-center md:grid md:grid-cols-3 md:items-center w-full mb-[60px]">
        <img
          src="/images/logo.png"
          alt="Simbora Maranhão"
          style={{
            height: "36px",
            maxHeight: "36px",
            width: "auto",
            maxWidth: "160px",
            display: "block",
            objectFit: "contain",
          }}
          className="md:justify-self-start"
        />
        <span className="inline-block bg-cyan/10 border border-cyan/20 text-cyan font-sans font-medium text-[0.8rem] tracking-[0.15em] uppercase py-2 px-5 rounded-lg md:justify-self-center text-center">
          Para médicos que querem crescer online
        </span>
        <div className="hidden md:block"></div>
      </div>

      <div className="text-center max-w-[860px] mx-auto">
        <h1 className="font-display-serif font-normal text-[3.5rem] leading-[1.1] text-dark mb-4 max-sm:text-[2.2rem]">
          Seu nome na cabeça do paciente<br />
          antes mesmo da consulta.
        </h1>

        <p className="font-sans font-normal text-[1.1rem] text-gray-500 leading-[1.7] max-w-[640px] mx-auto mb-7">
          A Simbora constrói sua autoridade digital em 90 dias — com gestão de redes,
          conteúdo estratégico e vídeos que posicionam você como referência na sua especialidade.
        </p>

        <div className="w-full max-w-[760px] aspect-video bg-gray-100 rounded-2xl border border-gray-200 flex items-center justify-center mx-auto mb-7">
          <div className="flex flex-col items-center gap-3">
            <span className="text-cyan text-[3rem] cursor-pointer">▶</span>
            <span className="font-sans font-normal text-[0.9rem] text-gray-400">
              Vídeo de apresentação
            </span>
          </div>
        </div>

        <a
          href="https://wa.me/5598999999999"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-fit cursor-pointer mx-auto text-center bg-cyan text-black font-sans font-semibold text-base py-[18px] px-12 rounded-lg no-underline shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_-1px_0_rgba(0,0,0,0.15)_inset,0_4px_20px_rgba(0,200,200,0.25)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_-1px_0_rgba(0,0,0,0.15)_inset,0_8px_28px_rgba(0,200,200,0.35)] active:translate-y-px active:shadow-[0_1px_4px_rgba(0,0,0,0.15)] max-sm:w-full max-sm:max-w-[480px] max-sm:py-4 max-sm:px-6"
        >
          Quero construir minha autoridade →
        </a>

        <p className="font-sans font-normal text-[0.8rem] text-gray-400 text-center mt-3">
          Sem contrato de fidelidade. Resultado em 90 dias.
        </p>
      </div>
    </section>
  );
}
