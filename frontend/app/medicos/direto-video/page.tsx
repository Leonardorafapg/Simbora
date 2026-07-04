import HeroDiretoVideo from "@/components/lp/medicos/HeroDiretoVideo";
import ProvasSocial from "@/components/lp/medicos/ProvasSocial";
import Entregaveis from "@/components/lp/medicos/Entregaveis";
import ComoFuncionaDireto from "@/components/lp/medicos/ComoFuncionaDireto";
import FAQ from "@/components/lp/medicos/FAQ";
import CTAFinal from "@/components/lp/medicos/CTAFinal";
import Footer from "@/components/site/Footer";

export default function DiretoVideoPage() {
  return (
    <main className="relative z-[1] bg-white">
      <HeroDiretoVideo />
      <ProvasSocial />
      <Entregaveis />
      <ComoFuncionaDireto />
      <FAQ />
      <CTAFinal />
      <Footer />
    </main>
  );
}
