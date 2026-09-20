"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "./ToastProvider";

export default function NewPageButton() {
  const router = useRouter();
  const { notify } = useToast();
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;

    setPending(true);
    const response = await fetch("/api/admin/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    });

    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      notify(`Página "${body.title}" creada`);
      router.push(`/admin/content/${body.slug}`);
      router.refresh();
    } else {
      notify(body.error || "No se pudo crear la página", "error");
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
      >
        + Nueva página
      </button>
    );
  }

  return (
    <form onSubmit={create} className="flex items-center gap-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título de la página"
        autoFocus
        className="w-56 rounded border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-900"
      />
      <button
        type="submit"
        disabled={!title.trim() || pending}
        className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-40"
      >
        {pending ? "Creando…" : "Crear"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded px-2 py-2 text-sm text-neutral-600 transition hover:text-neutral-900"
      >
        Cancelar
      </button>
    </form>
  );
}
