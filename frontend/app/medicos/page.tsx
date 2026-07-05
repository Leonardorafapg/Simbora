import HeroDiretoVideo from "@/components/lp/medicos/HeroDiretoVideo";
import CustoFicarParado from "@/components/lp/medicos/CustoFicarParado";
import ComoFuncionaDireto from "@/components/lp/medicos/ComoFuncionaDireto";
import FAQ from "@/components/lp/medicos/FAQ";
import CTAFinal from "@/components/lp/medicos/CTAFinal";
import Footer from "@/components/site/Footer";

export default function MedicosPage() {
  return (
    <main className="relative z-[1] bg-white">
      <HeroDiretoVideo />
      <ComoFuncionaDireto />
      <CustoFicarParado />
      <FAQ />
      <CTAFinal />
      <Footer />
    </main>
  );
}
