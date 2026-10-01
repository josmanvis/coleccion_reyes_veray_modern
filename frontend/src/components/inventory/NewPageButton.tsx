"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "./ToastProvider";
import { useTr } from "@/components/I18nProvider";

export default function NewPageButton() {
  const tr = useTr();
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
      notify(tr("Página \"{title}\" creada", { title: body.title }));
      router.push(`/admin/content/${body.slug}`);
      router.refresh();
    } else {
      notify(tr(body.error || "No se pudo crear la página"), "error");
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-hover)]"
      >
        
        {tr("+ Nueva página")}
      </button>
    );
  }

  return (
    <form onSubmit={create} className="flex items-center gap-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={tr("Título de la página")}
        autoFocus
        className="w-56 rounded border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm outline-none transition focus:border-[var(--brand)]"
      />
      <button
        type="submit"
        disabled={!title.trim() || pending}
        className="rounded bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-hover)] disabled:opacity-40"
      >
        {pending ? tr("Creando…") : tr("Crear")}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded px-2 py-2 text-sm text-[var(--ink-3)] transition hover:text-[var(--ink-1)]"
      >
        
        {tr("Cancelar")}
      </button>
    </form>
  );
}
