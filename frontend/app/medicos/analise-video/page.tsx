import HeroAnaliseVideo from "@/components/lp/medicos/HeroAnaliseVideo";
import ProvasSocial from "@/components/lp/medicos/ProvasSocial";
import Entregaveis from "@/components/lp/medicos/Entregaveis";
import ComoFunciona from "@/components/lp/medicos/ComoFunciona";
import PorQueGratis from "@/components/lp/medicos/PorQueGratis";
import FAQ from "@/components/lp/medicos/FAQ";
import CTAFinal from "@/components/lp/medicos/CTAFinal";
import Footer from "@/components/site/Footer";

export default function AnaliseVideoPage() {
  return (
    <main className="relative z-[1] bg-white">
      <HeroAnaliseVideo />
      <ProvasSocial />
      <Entregaveis />
      <ComoFunciona />
      <PorQueGratis />
      <FAQ />
      <CTAFinal />
      <Footer />
    </main>
  );
}
