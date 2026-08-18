import Image from "next/image";

export default function LoginSplash() {
  return (
    <div
      data-theme="dark"
      className="fixed inset-0 z-50 flex items-center justify-center bg-dark"
      role="status"
      aria-label="Carregando"
    >
      <Image
        src="/logo.png"
        alt="Simbora"
        width={140}
        height={106}
        className="h-24 w-auto animate-pulse"
        priority
      />
    </div>
  );
}
