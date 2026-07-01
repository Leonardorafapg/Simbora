import Hero from "@/components/lp/medicos/Hero";
import ProvasSocial from "@/components/lp/medicos/ProvasSocial";
import Entregaveis from "@/components/lp/medicos/Entregaveis";
import Resultados from "@/components/lp/medicos/Resultados";
import Sobre from "@/components/lp/medicos/Sobre";
import FAQ from "@/components/lp/medicos/FAQ";
import CTAFinal from "@/components/lp/medicos/CTAFinal";

export default function MedicosPage() {
  return (
    <main className="relative z-[1] bg-white">
      <Hero />
      <ProvasSocial />
      <Entregaveis />
      <Resultados />
      <Sobre />
      <FAQ />
      <CTAFinal />
    </main>
  );
}
