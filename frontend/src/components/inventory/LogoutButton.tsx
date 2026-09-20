"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
      className="rounded border border-neutral-300 px-3 py-1.5 text-neutral-700 transition hover:border-neutral-600 hover:text-black disabled:opacity-50"
    >
      {pending ? "Saliendo…" : "Salir"}
    </button>
  );
}
