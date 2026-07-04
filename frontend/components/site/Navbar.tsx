"use client";

import { useState } from "react";

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function TikTokIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 12a4 4 0 1 0 4 4V2" />
      <path d="M13 6a5 5 0 0 0 5 5" />
    </svg>
  );
}

function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

const socialLinks = [
  { label: "Instagram", href: "#", Icon: InstagramIcon },
  { label: "TikTok", href: "#", Icon: TikTokIcon },
  { label: "LinkedIn", href: "#", Icon: LinkedinIcon },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { label: "Home", href: "#", active: true },
    { label: "Sobre", href: "#", active: false },
    { label: "Serviços", href: "#", active: false },
  ];

  return (
    <header
      id="navbar"
      className="absolute top-0 inset-x-0 z-[100] bg-dark/[0.020] backdrop-blur-[2px] shadow-xs"
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        {/* Left: Logo */}
        <a href="#" className="flex items-center">
          <img
            src="/images/logo.png"
            alt="Simbora Maranhão"
            className="h-9 w-auto"
          />
        </a>

        {/* Right: Desktop Menu Links + CTA Button */}
        <div className="hidden items-center gap-12 lg:flex">
          <div className="flex items-center gap-8">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={`group relative font-sans text-sm font-bold transition-colors duration-200 ${
                  link.active ? "text-dark" : "text-gray-500 hover:text-dark"
                }`}
              >
                {link.label}
                <span
                  className={`absolute -bottom-1 left-0 h-px bg-dark transition-all duration-300 ${
                    link.active ? "w-full" : "w-0 group-hover:w-full"
                  }`}
                ></span>
              </a>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {socialLinks.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="text-gray-500 hover:text-dark transition-colors duration-200"
              >
                <Icon className="h-[18px] w-[18px]" />
              </a>
            ))}
          </div>

          <a
            href="#"
            className="rounded-none bg-dark text-white px-6 py-2.5 text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-95"
          >
            Entrar em contato
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Abrir menu"
          aria-expanded={isOpen}
          className="flex h-10 w-10 items-center justify-center lg:hidden"
        >
          {isOpen ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="h-5 w-5 text-dark"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="h-5 w-5 text-dark"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile Drawer */}
      {isOpen && (
        <div
          id="mobile-menu"
          className="flex flex-col gap-6 bg-white border-t border-gray-100 px-6 pb-8 pt-6 lg:hidden"
        >
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className={`text-xl font-bold transition-colors duration-200 ${
                link.active ? "text-dark" : "text-gray-500"
              }`}
            >
              {link.label}
            </a>
          ))}

          <div className="flex items-center gap-6">
            {socialLinks.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="text-gray-500 hover:text-dark transition-colors duration-200"
              >
                <Icon className="h-5 w-5" />
              </a>
            ))}
          </div>

          <a
            href="#"
            onClick={() => setIsOpen(false)}
            className="w-full text-center rounded-none bg-dark text-white px-6 py-3 text-base font-semibold transition-all duration-200"
          >
            Entrar em contato
          </a>
        </div>
      )}
    </header>
  );
}
