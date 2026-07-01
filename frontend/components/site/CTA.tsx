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
    if (!name || !email || !companyName || !segment || !revenueRange) {
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
        companyName,
        segment,
        revenueRange,
        source: "site",
      });
      setSuccess(true);
      setName("");
      setEmail("");
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
    <section ref={containerRef} id="cta" className="relative z-[1] py-16 sm:py-24 bg-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
          {/* Left Column: CTA Info */}
          <div id="cta-info" className="flex flex-col text-left">
            <h2 id="cta-title" className="font-sans text-4xl font-light text-black sm:text-6xl leading-tight">
              Pronto pra <br className="hidden sm:inline" />
              <span className="text-[#0A3D4D] font-normal">crescer?</span>
            </h2>
            <p className="mt-6 font-sans text-base text-gray-600 sm:text-lg leading-relaxed max-w-md">
              Fale com a Simbora e comece hoje mesmo. Se preferir um contato direto pelo WhatsApp, utilize o botão abaixo.
            </p>
            <div className="mt-8">
              <a
                id="cta-button"
                href="https://wa.me/5598999999999"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-lg bg-cyan px-8 py-4 font-sans text-base font-semibold text-black [transition:all_0.2s_ease] shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_-1px_0_rgba(0,0,0,0.3)_inset,0_4px_20px_rgba(0,200,200,0.25)] hover:scale-[1.04] hover:-translate-y-px hover:shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_-1px_0_rgba(0,0,0,0.4)_inset,0_8px_24px_rgba(0,0,0,0.15)] active:translate-y-px active:shadow-[0_1px_4px_rgba(0,0,0,0.3)]"
              >
                Falar pelo WhatsApp
              </a>
            </div>
          </div>

          {/* Right Column: Lead Form */}
          <div id="cta-form-container" className="bg-[#0A3D4D] border border-[#082f3b] rounded-2xl p-8 sm:p-10 shadow-[0_20px_50px_rgba(10,61,77,0.15)]">
            <h3 className="font-sans text-2xl font-light text-white mb-6">
              Preencha os dados
            </h3>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label htmlFor="name" className="block font-sans text-xs font-medium text-white/80 uppercase tracking-wider mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Seu nome"
                  className="w-full rounded-lg bg-white border border-transparent px-4 py-3 font-sans text-sm text-black placeholder-gray-400 focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="companyName" className="block font-sans text-xs font-medium text-white/80 uppercase tracking-wider mb-2">
                    Nome da Empresa *
                  </label>
                  <input
                    type="text"
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    placeholder="Sua empresa"
                    className="w-full rounded-lg bg-white border border-transparent px-4 py-3 font-sans text-sm text-black placeholder-gray-400 focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="segment" className="block font-sans text-xs font-medium text-white/80 uppercase tracking-wider mb-2">
                    Segmento *
                  </label>
                  <input
                    type="text"
                    id="segment"
                    value={segment}
                    onChange={(e) => setSegment(e.target.value)}
                    required
                    placeholder="Ex: Varejo, Saúde"
                    className="w-full rounded-lg bg-white border border-transparent px-4 py-3 font-sans text-sm text-black placeholder-gray-400 focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-colors"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block font-sans text-xs font-medium text-white/80 uppercase tracking-wider mb-2">
                  E-mail Profissional *
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="voce@empresa.com.br"
                  className="w-full rounded-lg bg-white border border-transparent px-4 py-3 font-sans text-sm text-black placeholder-gray-400 focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-colors"
                />
              </div>

              <div>
                <label htmlFor="revenueRange" className="block font-sans text-xs font-medium text-white/80 uppercase tracking-wider mb-2">
                  Faturamento Mensal *
                </label>
                <div className="relative">
                  <select
                    id="revenueRange"
                    value={revenueRange}
                    onChange={(e) => setRevenueRange(e.target.value)}
                    required
                    className="w-full rounded-lg bg-white border border-transparent px-4 py-3 font-sans text-sm text-black placeholder-gray-400 focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-colors appearance-none"
                    style={{
                      backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 1rem center',
                      backgroundSize: '1em'
                    }}
                  >
                    <option value="" disabled className="bg-white text-gray-400">Selecione uma faixa</option>
                    <option value="Até R$ 10.000 / mês" className="bg-white text-black">Até R$ 10.000 / mês</option>
                    <option value="R$ 10.000 a R$ 30.000 / mês" className="bg-white text-black">R$ 10.000 a R$ 30.000 / mês</option>
                    <option value="R$ 30.000 a R$ 50.000 / mês" className="bg-white text-black">R$ 30.000 a R$ 50.000 / mês</option>
                    <option value="R$ 50.000 a R$ 100.000 / mês" className="bg-white text-black">R$ 50.000 a R$ 100.000 / mês</option>
                    <option value="Acima de R$ 100.000 / mês" className="bg-white text-black">Acima de R$ 100.000 / mês</option>
                  </select>
                </div>
              </div>

              {error && (
                <p className="font-sans text-xs font-medium text-red-300">
                  {error}
                </p>
              )}

              {success && (
                <p className="font-sans text-xs font-medium text-cyan">
                  Formulário enviado com sucesso! Entraremos em contato em breve.
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-4 w-full rounded-lg bg-cyan px-6 py-4 font-sans text-sm font-semibold text-black cursor-pointer [transition:all_0.2s_ease] shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_-1px_0_rgba(0,0,0,0.3)_inset,0_4px_20px_rgba(0,200,200,0.25)] hover:scale-[1.02] hover:shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_-1px_0_rgba(0,0,0,0.4)_inset,0_8px_24px_rgba(0,0,0,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
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
