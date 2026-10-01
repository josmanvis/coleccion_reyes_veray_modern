"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await fetch("/api/auth", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-[var(--radius)] px-3 py-1.5 text-sm text-white/90 transition-colors hover:bg-white/15 hover:text-white disabled:opacity-60"
    >
      <LogOut size={15} strokeWidth={1.75} aria-hidden />
      {pending ? "Saliendo…" : "Salir"}
    </button>
  );
}
