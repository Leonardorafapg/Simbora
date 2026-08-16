"use client";

import { useLogin } from "@/hooks/useLogin";

export default function LoginForm() {
  const { email, setEmail, password, setPassword, error, loading, submit } = useLogin();

  return (
    <form onSubmit={submit} className="w-full flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm text-white/70">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="glass-input rounded-lg px-4 py-2.5 text-sm outline-none"
          placeholder="voce@simbora.com.br"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm text-white/70">
          Senha
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="glass-input rounded-lg px-4 py-2.5 text-sm outline-none"
          placeholder="••••••••"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-lg bg-cyan px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-dark disabled:opacity-60"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
