"use client";

import { useRef, useState } from "react";

const clientLogos = [
  { name: "Ferreiro Grill", logo: "/images/ferreiro-grill.png", scaleClass: "scale-[1.65]" },
  { name: "Ferreiro Prime", logo: "/images/ferreiro-prime.png" },
  { name: "Bistrô & Boteco", logo: "/images/bistro-boteco.png", scaleClass: "scale-[2]" },
  { name: "Ferreiro Praia", logo: "/images/ferreiro-praia.png" },
  { name: "Tasquinha Ferreiro", logo: "/images/tasquinha-ferreiro.png", scaleClass: "scale-[1.25]" },
  { name: "Honshu", logo: "/images/honshu.png" },
  { name: "Bicho Sadio", logo: "/images/bicho-sadio.png", scaleClass: "scale-[1.25]" },
  { name: "Bangalô Nordeste", logo: "/images/bangalo.png" },
  { name: "Arabian Grill", logo: "/images/arabian-grill.jpg", scaleClass: "scale-[1.3]" },
];

export default function Clientes() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDown, setIsDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const clientes = [...clientLogos, ...clientLogos];

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    setIsDown(true);
    trackRef.current.style.cursor = "grabbing";
    setStartX(e.pageX - trackRef.current.offsetLeft);
    setScrollLeft(trackRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    if (!trackRef.current) return;
    setIsDown(false);
    trackRef.current.style.cursor = "grab";
  };

  const handleMouseUp = () => {
    if (!trackRef.current) return;
    setIsDown(false);
    trackRef.current.style.cursor = "grab";
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDown || !trackRef.current) return;
    e.preventDefault();
    const x = e.pageX - trackRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    trackRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!trackRef.current) return;
    setIsDown(true);
    setStartX(e.touches[0].pageX - trackRef.current.offsetLeft);
    setScrollLeft(trackRef.current.scrollLeft);
  };

  const handleTouchEnd = () => {
    setIsDown(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDown || !trackRef.current) return;
    const x = e.touches[0].pageX - trackRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    trackRef.current.scrollLeft = scrollLeft - walk;
  };

  return (
    <section id="clientes" className="py-16 relative z-[1] max-sm:py-12 bg-white">
      <p className="text-center font-sans font-normal text-xs tracking-[0.2em] uppercase text-black/40 mb-10 max-sm:mb-8">
        empresas que já cresceram com a simbora
      </p>

      <div
        ref={trackRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        className="w-full overflow-x-auto select-none no-scrollbar"
        style={{ cursor: "grab", scrollbarWidth: "none" }}
      >
        <div className="flex items-center gap-16 px-20 w-max max-sm:gap-10 max-sm:px-5">
          {clientes.map((cliente, i) => (
            <div
              key={i}
              className="flex-shrink-0 h-40 w-[416px] flex items-center justify-center p-4 hover:scale-105 transition-all duration-300 select-none opacity-70 hover:opacity-100"
            >
              <img
                src={cliente.logo}
                alt={cliente.name}
                className={`max-h-full max-w-full object-contain ${cliente.scaleClass || ""}`}
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
