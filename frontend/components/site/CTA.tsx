"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { submitLead } from "@/lib/api";

gsap.registerPlugin(ScrollTrigger);

export default function CTA() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [segment, setSegment] = useState("");
  const [revenueRange, setRevenueRange] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useGSAP(
    () => {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const info = containerRef.current?.querySelector("#cta-info");
      const form = containerRef.current?.querySelector("#cta-form-container");

      if (prefersReducedMotion) {
        gsap.set([info, form], { opacity: 1, x: 0 });
      } else {
        if (info) {
          gsap.fromTo(
            info,
            { opacity: 0, x: -50 },
            {
              opacity: 1,
              x: 0,
              duration: 0.8,
              ease: "power3.out",
              scrollTrigger: { trigger: containerRef.current, start: "top 80%" },
            }
          );
        }
        if (form) {
          gsap.fromTo(
            form,
            { opacity: 0, x: 50 },
            {
              opacity: 1,
              x: 0,
              duration: 0.8,
              ease: "power3.out",
              scrollTrigger: { trigger: containerRef.current, start: "top 80%" },
            }
          );
        }
      }
    },
    { scope: containerRef }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !whatsapp || !companyName || !segment || !revenueRange) {
      setError("Por favor, preencha todos os campos obrigatórios.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      await submitLead({
        name,
        email,
        phone: whatsapp,
        instagram: instagram || undefined,
        companyName,
        segment,
        revenueRange,
        source: "site",
      });
      setSuccess(true);
      setName("");
      setEmail("");
      setWhatsapp("");
      setInstagram("");
      setCompanyName("");
      setSegment("");
      setRevenueRange("");
    } catch (err: any) {
      setError(err.message || "Erro ao enviar o formulário. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section ref={containerRef} id="cta" className="relative z-[1] bg-white py-16 sm:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
          {/* Left Column: CTA Info */}
          <div id="cta-info" className="flex flex-col text-left">
            <h2 id="cta-title" className="font-sans text-4xl font-normal text-dark sm:text-6xl leading-[1.1]">
              Sua concorrência está ocupando um espaço que deveria ser seu.
            </h2>
            <p className="mt-6 font-sans font-light text-base text-gray-500 sm:text-lg leading-relaxed max-w-md">
              Todos os dias, pessoas na sua região buscam por serviços como o seu no Google e nas redes sociais. Quem não tem presença digital simplesmente não aparece nessa decisão, e perde o cliente pra quem apareceu primeiro. A Simbora coloca sua marca no caminho de quem já está pronto pra comprar. Preencha o formulário e comece a aparecer.
            </p>
            <p className="mt-6 font-sans text-sm text-gray-400">
              Ou se preferir, fale direto pelo WhatsApp:
            </p>
            <div className="mt-3">
              <a
                id="cta-button"
                href="https://wa.me/5598999999999"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-lg bg-cyan px-8 py-4 font-sans text-base font-semibold text-black transition-all duration-200 shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_-1px_0_rgba(0,0,0,0.3)_inset,0_4px_20px_rgba(0,200,200,0.25)] hover:scale-[1.04] hover:-translate-y-px hover:shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_-1px_0_rgba(0,0,0,0.4)_inset,0_8px_24px_rgba(0,200,200,0.4)] active:translate-y-px active:shadow-[0_1px_4px_rgba(0,0,0,0.3)]"
              >
                Falar pelo WhatsApp
              </a>
            </div>
          </div>
 
          {/* Right Column: Lead Form */}
          <div id="cta-form-container" className="bg-[#f9fafb] border border-gray-200 rounded-3xl p-8 sm:p-10 shadow-md relative overflow-hidden">
            {/* Ambient inner glow for form container */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan/5 rounded-full filter blur-3xl pointer-events-none"></div>
            
            <h3 className="font-sans text-2xl font-normal text-dark mb-6">
              Quero descobrir como a Simbora pode me ajudar a alavancar minhas vendas
            </h3>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-5 relative z-10">
              <div>
                <label htmlFor="name" className="block font-sans text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Seu nome"
                  className="w-full rounded-lg px-4 py-3 font-sans text-sm text-dark placeholder-gray-400 bg-white border border-gray-200 focus:outline-none focus:border-cyan"
                />
              </div>
 
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="companyName" className="block font-sans text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                    Nome da Empresa *
                  </label>
                  <input
                    type="text"
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    placeholder="Sua empresa"
                    className="w-full rounded-lg px-4 py-3 font-sans text-sm text-dark placeholder-gray-400 bg-white border border-gray-200 focus:outline-none focus:border-cyan"
                  />
                </div>
                <div>
                  <label htmlFor="segment" className="block font-sans text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                    Segmento *
                  </label>
                  <input
                    type="text"
                    id="segment"
                    value={segment}
                    onChange={(e) => setSegment(e.target.value)}
                    required
                    placeholder="Ex: Varejo, Saúde"
                    className="w-full rounded-lg px-4 py-3 font-sans text-sm text-dark placeholder-gray-400 bg-white border border-gray-200 focus:outline-none focus:border-cyan"
                  />
                </div>
              </div>
 
              <div>
                <label htmlFor="email" className="block font-sans text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                  E-mail Profissional *
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="voce@empresa.com.br"
                  className="w-full rounded-lg px-4 py-3 font-sans text-sm text-dark placeholder-gray-400 bg-white border border-gray-200 focus:outline-none focus:border-cyan"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="whatsapp" className="block font-sans text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                    WhatsApp *
                  </label>
                  <input
                    type="tel"
                    id="whatsapp"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    required
                    placeholder="(98) 99999-9999"
                    className="w-full rounded-lg px-4 py-3 font-sans text-sm text-dark placeholder-gray-400 bg-white border border-gray-200 focus:outline-none focus:border-cyan"
                  />
                </div>
                <div>
                  <label htmlFor="instagram" className="block font-sans text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                    Instagram
                  </label>
                  <input
                    type="text"
                    id="instagram"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="@suaempresa"
                    className="w-full rounded-lg px-4 py-3 font-sans text-sm text-dark placeholder-gray-400 bg-white border border-gray-200 focus:outline-none focus:border-cyan"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="revenueRange" className="block font-sans text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                  Faturamento Mensal *
                </label>
                <div className="relative">
                  <select
                    id="revenueRange"
                    value={revenueRange}
                    onChange={(e) => setRevenueRange(e.target.value)}
                    required
                    className="w-full rounded-lg px-4 py-3 font-sans text-sm text-dark placeholder-gray-400 bg-white border border-gray-200 focus:outline-none focus:border-cyan appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 1rem center',
                      backgroundSize: '1em'
                    }}
                  >
                    <option value="" disabled className="bg-white text-gray-400">Selecione uma faixa</option>
                    <option value="Até R$ 10.000 / mês" className="bg-white text-dark">Até R$ 10.000 / mês</option>
                    <option value="R$ 10.000 a R$ 30.000 / mês" className="bg-white text-dark">R$ 10.000 a R$ 30.000 / mês</option>
                    <option value="R$ 30.000 a R$ 50.000 / mês" className="bg-white text-dark">R$ 30.000 a R$ 50.000 / mês</option>
                    <option value="R$ 50.000 a R$ 100.000 / mês" className="bg-white text-dark">R$ 50.000 a R$ 100.000 / mês</option>
                    <option value="Acima de R$ 100.000 / mês" className="bg-white text-dark">Acima de R$ 100.000 / mês</option>
                  </select>
                </div>
              </div>
 
              {error && (
                <p className="font-sans text-xs font-medium text-red-500">
                  {error}
                </p>
              )}
 
              {success && (
                <p className="font-sans text-xs font-medium text-cyan-dark">
                  Formulário enviado com sucesso! Entraremos em contato em breve.
                </p>
              )}
 
              <button
                type="submit"
                disabled={loading}
                className="mt-4 w-full rounded-lg bg-cyan px-6 py-4 font-sans text-sm font-semibold text-black cursor-pointer transition-all duration-200 shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_-1px_0_rgba(0,0,0,0.3)_inset,0_4px_20px_rgba(0,200,200,0.25)] hover:scale-[1.02] hover:shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_-1px_0_rgba(0,0,0,0.4)_inset,0_8px_24px_rgba(0,200,200,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Enviando..." : "Quero Receber Contato"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
