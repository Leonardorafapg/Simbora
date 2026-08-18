"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/services/client/authApi";
import { fetchClients } from "@/services/client/clientApi";
import { fetchTeamMembers } from "@/services/client/teamApi";
import { getOrFetch } from "@/lib/dataCache";

// Duração mínima da splash de boas-vindas, mesmo se o prefetch terminar antes
// — é uma pausa de marca proposital, não só um indicador de carregamento.
const SPLASH_MIN_MS = 2500;

// Teto de segurança: mesmo que o prefetch trave por algum motivo não previsto
// (rede, backend fora do ar), a splash não pode ficar presa pra sempre — o
// usuário precisa conseguir entrar mesmo sem o cache aquecido.
const PREFETCH_TIMEOUT_MS = 8000;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await login({ email, password });

      if (!result.ok) {
        setError(result.message);
        setLoading(false);
        return;
      }

      setShowSplash(true);

      // Aproveita a splash pra deixar clientes e equipe já em cache — são
      // listas pequenas e usadas em quase toda tela do CRM. O resto (demandas,
      // calendário) continua carregando por página, sob demanda.
      const prefetch = Promise.all([
        getOrFetch("clients", fetchClients).catch(() => null),
        getOrFetch("teamMembers", fetchTeamMembers).catch(() => null),
      ]);

      await Promise.all([Promise.race([prefetch, wait(PREFETCH_TIMEOUT_MS)]), wait(SPLASH_MIN_MS)]);

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Erro ao conectar com o servidor.");
      setShowSplash(false);
      setLoading(false);
    }
  }

  return { email, setEmail, password, setPassword, error, loading, showSplash, submit };
}
