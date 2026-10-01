"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      router.replace(next);
      router.refresh();
      return;
    }

    const body = await response.json().catch(() => ({}));
    setError(body.error || "No se pudo iniciar sesión");
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-3">
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Usuario"
        autoFocus
        autoComplete="username"
        className="w-full rounded border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand)]"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Contraseña"
        autoComplete="current-password"
        className="w-full rounded border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand)]"
      />
      <button
        type="submit"
        disabled={pending || !password || !username}
        className="w-full rounded bg-[var(--brand)] px-3 py-2.5 text-sm text-white transition hover:bg-[var(--brand-hover)] disabled:opacity-40"
      >
        {pending ? "Verificando…" : "Entrar"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
