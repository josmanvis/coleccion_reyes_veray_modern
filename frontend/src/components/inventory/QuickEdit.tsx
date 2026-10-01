"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FIELD_BY_KEY, QUICK_EDIT_KEYS } from "@/lib/inventory/fields";
import { useToast } from "./ToastProvider";
import { useTr } from "@/components/I18nProvider";

export type QuickValues = Record<string, string>;

/**
 * Edits one work without leaving the list. Reaching the full form costs three
 * page loads and loses the filters and scroll position, which made correcting a
 * run of records tedious; this keeps the list on screen behind the panel.
 */
export default function QuickEdit({
  refId,
  registro,
  title,
  values,
}: {
  refId: string;
  registro: string;
  title: string;
  values: QuickValues;
}) {
  const tr = useTr();
  const router = useRouter();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<QuickValues>(values);
  const [pending, setPending] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);

  const changed = QUICK_EDIT_KEYS.filter((key) => (draft[key] ?? "") !== (values[key] ?? ""));

  // The draft is seeded when the panel opens rather than in an effect, so a
  // refreshed row never overwrites what is being typed.
  function openPanel() {
    setDraft(values);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    firstField.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function save() {
    if (changed.length === 0) return;
    setPending(true);

    const patch = Object.fromEntries(changed.map((key) => [key, draft[key] ?? ""]));
    const response = await fetch(`/api/inventory/${encodeURIComponent(refId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    if (response.ok) {
      notify(
        tr(changed.length === 1 ? "#{registro}: {n} campo actualizado" : "#{registro}: {n} campos actualizados", { registro, n: changed.length })
      );
      setOpen(false);
      router.refresh();
    } else {
      const body = await response.json().catch(() => ({}));
      notify(tr(body.error || "No se pudo guardar"), "error");
    }
    setPending(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        className="rounded border border-[var(--stroke)] px-2 py-1 text-xs text-[var(--ink-2)] transition hover:bg-[var(--hover)] hover:text-[var(--ink-1)]"
      >
        
        {tr("Editar")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label={tr("Cerrar")}
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-black/20"
          />

          <aside
            role="dialog"
            aria-modal="true"
            aria-label={tr("Editar {title}", { title })}
            className="relative flex h-full w-full max-w-[460px] flex-col border-l border-[var(--stroke)] bg-[var(--surface)] shadow-xl"
          >
            <header className="border-b border-[var(--stroke-soft)] px-5 py-4">
              <p className="font-mono text-xs text-[var(--ink-3)]">{tr("CRV #{n}", { n: registro })}</p>
              <h2 className="mt-0.5 text-base font-semibold leading-tight">{title}</h2>
              <Link
                href={`/admin/artwork/${encodeURIComponent(refId)}`}
                className="mt-1.5 inline-block text-xs text-[var(--ink-3)] underline-offset-2 hover:text-[var(--ink-1)] hover:underline"
              >
                
                {tr("Editar todos los campos →")}
              </Link>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {QUICK_EDIT_KEYS.map((key, index) => {
                const field = FIELD_BY_KEY.get(key);
                if (!field) return null;
                const isLong = field.type === "longtext";
                const isDirty = (draft[key] ?? "") !== (values[key] ?? "");

                return (
                  <label key={key} className="flex flex-col gap-1">
                    <span className="flex items-center gap-1.5 text-xs text-[var(--ink-3)]">
                      {tr(field.label)}
                      {isDirty && <span className="size-1.5 rounded-full bg-amber-500" />}
                    </span>
                    {isLong ? (
                      <textarea
                        value={draft[key] ?? ""}
                        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                        rows={3}
                        className="w-full rounded border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm leading-relaxed outline-none transition focus:border-[var(--brand)]"
                      />
                    ) : (
                      <input
                        ref={index === 0 ? firstField : undefined}
                        type={field.type === "int" || field.type === "money" ? "number" : "text"}
                        value={draft[key] ?? ""}
                        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                        className="w-full rounded border border-[var(--stroke)] bg-[var(--surface)] px-3 py-1.5 text-sm outline-none transition focus:border-[var(--brand)]"
                      />
                    )}
                  </label>
                );
              })}
            </div>

            <footer className="flex items-center gap-3 border-t border-[var(--stroke-soft)] px-5 py-3">
              <span className="text-xs text-[var(--ink-3)]">
                {changed.length === 0
                  ? tr("Sin cambios")
                  : tr(changed.length === 1 ? "{n} campo modificado" : "{n} campos modificados", { n: changed.length })}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded border border-[var(--stroke)] px-3 py-1.5 text-sm text-[var(--ink-2)] transition hover:bg-[var(--hover)]"
                >
                  
                  {tr("Cancelar")}
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={changed.length === 0 || pending}
                  className="rounded bg-[var(--brand)] px-4 py-1.5 text-sm text-white transition hover:bg-[var(--brand-hover)] disabled:opacity-40"
                >
                  {pending ? tr("Guardando…") : tr("Guardar")}
                </button>
              </div>
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}
