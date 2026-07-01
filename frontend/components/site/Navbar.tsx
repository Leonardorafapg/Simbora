"use client";

import { useState } from "react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { label: "Serviços", href: "#servicos" },
    { label: "Cases", href: "#cases" },
    { label: "Sobre", href: "#sobre" },
  ];

  return (
    <header id="navbar" className="absolute top-0 left-0 right-0 z-[100] lg:bg-transparent bg-black/30 backdrop-blur-md lg:backdrop-blur-none">
      <nav className="mx-auto grid max-w-7xl grid-cols-3 items-center px-6 py-4 lg:px-10">
        <a href="#" className="flex items-center">
          <img src="/images/logo.png" alt="Simbora Maranhão" className="h-10 w-auto" />
        </a>

        <div className="hidden items-center justify-center gap-8 lg:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-sans text-sm font-medium text-white transition-colors hover:text-cyan"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center justify-end">
          <a
            href="#cta"
            className="hidden rounded-lg border border-cyan px-5 py-2 text-sm font-medium text-cyan [transition:all_0.2s_ease] shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_-1px_0_rgba(0,0,0,0.4)_inset,0_4px_16px_rgba(0,0,0,0.4)] hover:bg-cyan hover:text-black hover:-translate-y-px hover:shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_-1px_0_rgba(0,0,0,0.4)_inset,0_8px_24px_rgba(0,0,0,0.5)] active:translate-y-px active:shadow-[0_1px_4px_rgba(0,0,0,0.3)] lg:inline-block"
          >
            Fale Conosco
          </a>

          <button
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Abrir menu"
            aria-expanded={isOpen}
            className="flex flex-col gap-1.5 p-2 lg:hidden"
          >
            <span className={`h-0.5 w-6 bg-white transition-transform duration-200 ${isOpen ? "rotate-45 translate-y-2" : ""}`}></span>
            <span className={`h-0.5 w-6 bg-white transition-opacity duration-200 ${isOpen ? "opacity-0" : ""}`}></span>
            <span className={`h-0.5 w-6 bg-white transition-transform duration-200 ${isOpen ? "-rotate-45 -translate-y-2" : ""}`}></span>
          </button>
        </div>
      </nav>

      {isOpen && (
        <div
          id="mobile-menu"
          className="flex flex-col gap-4 bg-dark px-6 pb-6 pt-2 lg:hidden"
        >
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="font-sans text-sm font-medium text-white transition-colors hover:text-cyan"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#cta"
            onClick={() => setIsOpen(false)}
            className="w-fit rounded-lg border border-cyan px-5 py-2 text-sm font-medium text-cyan [transition:all_0.2s_ease] shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_-1px_0_rgba(0,0,0,0.4)_inset,0_4px_16px_rgba(0,0,0,0.4)] hover:bg-cyan hover:text-black hover:-translate-y-px hover:shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_-1px_0_rgba(0,0,0,0.4)_inset,0_8px_24px_rgba(0,0,0,0.5)] active:translate-y-px active:shadow-[0_1px_4px_rgba(0,0,0,0.3)]"
          >
            Fale Conosco
          </a>
        </div>
      )}
    </header>
  );
}
