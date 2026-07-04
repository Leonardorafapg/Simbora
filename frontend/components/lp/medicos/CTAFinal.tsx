"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

export default function CTAFinal() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.fromTo(
        ".cta-final-fade-in",
        { opacity: 0, y: 28 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power2.out",
          scrollTrigger: { trigger: containerRef.current, start: "top 85%" },
        }
      );
    },
    { scope: containerRef }
  );

  return (
    <section ref={containerRef} className="bg-dark py-32 px-10 max-sm:py-15 max-sm:px-5">
      <div className="max-w-[760px] mx-auto text-center">
        <h2 className="cta-final-fade-in opacity-0 font-display-serif font-normal text-[3.2rem] max-sm:text-3xl text-white leading-[1.2] mb-6">
          Pronto para ser o médico<br />
          mais conhecido da sua cidade?
        </h2>
        <p className="cta-final-fade-in opacity-0 font-sans font-normal text-base text-white/50 mb-10">
          Fale com a Simbora agora e comece sua transformação digital.
        </p>

        <a
          href="https://wa.me/5598999999999"
          target="_blank"
          rel="noopener noreferrer"
          className="cta-final-fade-in opacity-0 inline-block bg-cyan text-black font-sans font-semibold text-base py-[18px] px-12 rounded-lg no-underline shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_-1px_0_rgba(0,0,0,0.15)_inset,0_4px_20px_rgba(0,200,200,0.25)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_-1px_0_rgba(0,0,0,0.15)_inset,0_8px_28px_rgba(0,200,200,0.35)] max-sm:block max-sm:w-full max-sm:max-w-[480px] max-sm:mx-auto max-sm:py-4 max-sm:px-6"
        >
          Falar com a Simbora no WhatsApp →
        </a>
      </div>
    </section>
  );
}
