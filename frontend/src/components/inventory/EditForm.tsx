"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FIELDS, READONLY_KEYS } from "@/lib/inventory/fields";
import ArtworkFieldGrid, { type Values } from "./ArtworkFieldGrid";
import ConfirmDialog from "./ConfirmDialog";
import { useToast } from "./ToastProvider";

export default function EditForm({
  registro,
  initial,
}: {
  registro: string;
  initial: Values;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [asking, setAsking] = useState(false);
  const [values, setValues] = useState<Values>(initial);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = FIELDS.filter((f) => (values[f.key] ?? "") !== (initial[f.key] ?? ""));

  function set(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function requestSave(event: React.FormEvent) {
    event.preventDefault();
    if (changed.length > 0) setAsking(true);
  }

  async function save() {
    setPending(true);
    setError(null);

    const patch = Object.fromEntries(changed.map((f) => [f.key, values[f.key] ?? ""]));
    const response = await fetch(`/api/inventory/${encodeURIComponent(registro)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    if (response.ok) {
      setSaved(true);
      notify(
        `Guardado: ${changed.length} campo${changed.length === 1 ? "" : "s"} actualizado${
          changed.length === 1 ? "" : "s"
        }`
      );
      router.refresh();
    } else {
      const body = await response.json().catch(() => ({}));
      setError(body.error || "No se pudo guardar");
      notify(body.error || "No se pudo guardar", "error");
    }
    setPending(false);
    setAsking(false);
  }

  return (
    <form onSubmit={requestSave}>
      <div className="sticky top-[var(--admin-header-h)] z-30 -mx-5 mb-6 flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-[#fdfcfc]/95 px-5 py-3 backdrop-blur">
        <span className="text-sm text-neutral-600">
          {changed.length === 0
            ? "Sin cambios"
            : `${changed.length} campo${changed.length === 1 ? "" : "s"} modificado${
                changed.length === 1 ? "" : "s"
              }`}
        </span>
        {saved && <span className="text-sm text-emerald-700">Guardado</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setValues(initial);
              setSaved(false);
            }}
            disabled={changed.length === 0 || pending}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition hover:border-neutral-600 disabled:opacity-40"
          >
            Descartar
          </button>
          <button
            type="submit"
            disabled={changed.length === 0 || pending}
            className="rounded bg-black px-4 py-1.5 text-sm text-white transition hover:bg-neutral-700 disabled:opacity-40"
          >
            {pending ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>

      <ArtworkFieldGrid
        values={values}
        initial={initial}
        onChange={set}
        readOnlyKeys={READONLY_KEYS}
      />

      <ConfirmDialog
        open={asking}
        title="¿Guardar los cambios?"
        body={`Se actualizará${changed.length === 1 ? "" : "n"} ${changed.length} campo${
          changed.length === 1 ? "" : "s"
        } de esta ficha.`}
        detail={
          <ul className="space-y-0.5">
            {changed.slice(0, 8).map((field) => (
              <li key={field.key} className="truncate">
                {field.label}: {(initial[field.key] || "(vacío)").slice(0, 28)} →{" "}
                {(values[field.key] || "(vacío)").slice(0, 28)}
              </li>
            ))}
            {changed.length > 8 && <li>y {changed.length - 8} más…</li>}
          </ul>
        }
        confirmLabel="Guardar"
        pending={pending}
        onConfirm={save}
        onCancel={() => setAsking(false)}
      />
    </form>
  );
}
