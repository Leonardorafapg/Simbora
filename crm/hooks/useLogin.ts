"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/services/client/authApi";

export function useLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Erro ao conectar com o servidor.");
      setLoading(false);
    }
  }

  return { email, setEmail, password, setPassword, error, loading, submit };
}
