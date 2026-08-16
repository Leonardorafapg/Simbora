import Image from "next/image";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-card w-full max-w-sm rounded-2xl p-8 flex flex-col items-center">
        <Image src="/logo.png" alt="Simbora" width={84} height={64} className="h-16 w-auto mb-6" priority />
        <h1 className="text-lg font-semibold text-white mb-1">Painel interno</h1>
        <p className="text-sm text-white/50 mb-6 text-center">
          Entre com sua conta para acessar o CRM.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
