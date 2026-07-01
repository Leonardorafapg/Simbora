"use client";

import { useRef, useState } from "react";

export default function ProvasSocial() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDown, setIsDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const clientes = Array.from({ length: 8 }, (_, i) => `Médico ${i + 1}`);

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
    <section className="bg-[#f9fafb] py-[60px] px-10 max-sm:py-12 max-sm:px-5">
      <p className="font-sans font-normal text-[0.75rem] tracking-[0.2em] uppercase text-[#9ca3af] text-center mb-10 max-sm:mb-8">
        médicos que já cresceram com a simbora
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
        <div className="flex items-center gap-[60px] px-[60px] w-max max-sm:gap-8 max-sm:px-5">
          {clientes.map((nome, idx) => (
            <svg
              key={idx}
              className="flex-shrink-0 group cursor-pointer"
              width="120"
              height="40"
              viewBox="0 0 120 40"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                className="transition-colors duration-300 fill-[#E5E7EB] group-hover:fill-[#d1d5db]"
                width="120"
                height="40"
                rx="8"
              />
              <text
                className="font-sans font-medium fill-[#9CA3AF] text-[11px]"
                x="60"
                y="24"
                textAnchor="middle"
              >
                {nome}
              </text>
            </svg>
          ))}
        </div>
      </div>
    </section>
  );
}
