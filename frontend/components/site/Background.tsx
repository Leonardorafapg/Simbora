"use client";

export default function Background() {
  return (
    <div id="bg-canvas" className="fixed inset-0 z-0 bg-[#0D0D0D]">
      <div className="orb orb-1" id="orb1" style={{ opacity: 0.5 }}></div>
      <div className="orb orb-2" id="orb2" style={{ opacity: 0.3 }}></div>
      <div className="orb orb-3" id="orb3" style={{ opacity: 0.2 }}></div>
    </div>
  );
}
