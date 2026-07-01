export default function Footer() {
  return (
    <footer className="relative z-[1] border-t border-white/[0.08] py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
          <div>
            <img src="/images/logo.png" alt="Simbora Maranhão" className="h-10 w-auto" />
            <p className="mt-4 font-sans text-sm text-[#888888]">
              Marketing que move o Maranhão
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <a href="#servicos" className="font-sans text-sm text-[#888888] transition-colors hover:text-cyan">
              Serviços
            </a>
            <a href="#cases" className="font-sans text-sm text-[#888888] transition-colors hover:text-cyan">
              Cases
            </a>
            <a href="#sobre" className="font-sans text-sm text-[#888888] transition-colors hover:text-cyan">
              Sobre
            </a>
          </div>

          <div className="flex gap-4">
            <a
              href="#"
              aria-label="Instagram"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-[#888888] transition-colors hover:border-cyan hover:text-cyan"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
              >
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </a>
            <a
              href="https://wa.me/5598999999999"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-[#888888] transition-colors hover:border-cyan hover:text-cyan"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
              >
                <path d="M21 12a9 9 0 1 1-4.3-7.7" />
                <path d="M12 3a9 9 0 0 1 8.5 12.1L21 21l-6-1.4A9 9 0 0 1 12 3z" />
              </svg>
            </a>
            <a
              href="#"
              aria-label="LinkedIn"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-[#888888] transition-colors hover:border-cyan hover:text-cyan"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
              >
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <line x1="8" y1="11" x2="8" y2="16" />
                <line x1="8" y1="8" x2="8" y2="8" />
                <line x1="12" y1="11" x2="12" y2="16" />
                <path d="M12 13c0-1.5 1-2 2-2s2 .5 2 2v3" />
              </svg>
            </a>
          </div>
        </div>

        <div className="mt-12 border-t border-white/[0.08] pt-8 text-center">
          <p className="font-sans text-xs text-[#888888]">
            © 2025 Simbora Maranhão. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
