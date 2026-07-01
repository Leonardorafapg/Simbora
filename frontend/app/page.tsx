import Navbar from "@/components/site/Navbar";
import Hero from "@/components/site/Hero";
import Servicos from "@/components/site/Servicos";
import Clientes from "@/components/site/Clientes";
import Cases from "@/components/site/Cases";
import Depoimentos from "@/components/site/Depoimentos";
import Sobre from "@/components/site/Sobre";
import CTA from "@/components/site/CTA";
import Footer from "@/components/site/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <Servicos />
      <Clientes />
      <Cases />
      <Depoimentos />
      <Sobre />
      <CTA />
      <Footer />
    </>
  );
}
