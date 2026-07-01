export default function Hero() {
  return (
    <section
      id="hero"
      className="relative z-[1] flex h-screen w-full items-center justify-center overflow-hidden"
    >
      <video
        className="absolute inset-0 h-full w-full object-cover object-center"
        autoPlay
        muted
        loop
        playsInline
        src="/video/hero.mp4"
      ></video>

      <div className="absolute inset-0 bg-black/85"></div>

      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1/3"
        style={{
          background: "radial-gradient(circle at left, rgba(0,200,200,0.05), transparent 70%)",
        }}
      ></div>
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-1/3"
        style={{
          background: "radial-gradient(circle at right, rgba(0,200,200,0.05), transparent 70%)",
        }}
      ></div>
    </section>
  );
}
