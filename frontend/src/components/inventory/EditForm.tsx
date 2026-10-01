"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Save, Undo2 } from "lucide-react";
import { FIELDS, READONLY_KEYS } from "@/lib/inventory/fields";
import ArtworkFieldGrid, { type Values } from "./ArtworkFieldGrid";
import ConfirmDialog from "./ConfirmDialog";
import { useToast } from "./ToastProvider";
import { useTr } from "@/components/I18nProvider";

export default function EditForm({
  registro,
  initial,
}: {
  registro: string;
  initial: Values;
}) {
  const tr = useTr();
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
        tr(changed.length === 1 ? "Guardado: {n} campo actualizado" : "Guardado: {n} campos actualizados", { n: changed.length })
      );
      router.refresh();
    } else {
      const body = await response.json().catch(() => ({}));
      setError(tr(body.error || "No se pudo guardar"));
      notify(tr(body.error || "No se pudo guardar"), "error");
    }
    setPending(false);
    setAsking(false);
  }

  return (
    <form onSubmit={requestSave}>
      <div className="sticky top-[var(--admin-header-h)] z-30 -mx-5 mb-6 flex flex-wrap items-center gap-3 border-b border-[var(--stroke-soft)] bg-[var(--surface)] px-5 py-3 backdrop-blur">
        <span className="text-sm text-[var(--ink-3)]">
          {changed.length === 0
            ? tr("Sin cambios")
            : tr(changed.length === 1 ? "{n} campo modificado" : "{n} campos modificados", { n: changed.length })}
        </span>
        {saved && <span className="text-sm text-emerald-700">{tr("Guardado")}</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setValues(initial);
              setSaved(false);
            }}
            disabled={changed.length === 0 || pending}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--stroke)] px-3 py-1.5 text-sm font-semibold text-[var(--ink-2)] transition hover:bg-[var(--hover)] disabled:opacity-40"
          >
            <Undo2 size={15} strokeWidth={1.75} aria-hidden />
            
            {tr("Descartar")}
          </button>
          <button
            type="submit"
            disabled={changed.length === 0 || pending}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--brand)] px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-hover)] disabled:opacity-40"
          >
            <Save size={15} strokeWidth={1.75} aria-hidden />
            {pending ? tr("Guardando…") : tr("Guardar cambios")}
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
        title={tr("¿Guardar los cambios?")}
        body={tr(changed.length === 1 ? "Se actualizará {n} campo de esta ficha." : "Se actualizarán {n} campos de esta ficha.", { n: changed.length })}
        detail={
          <ul className="space-y-0.5">
            {changed.slice(0, 8).map((field) => (
              <li key={field.key} className="truncate">
                {field.label}: {(initial[field.key] || tr("(vacío)")).slice(0, 28)} →{" "}
                {(values[field.key] || tr("(vacío)")).slice(0, 28)}
              </li>
            ))}
            {changed.length > 8 && <li>{tr("y {n} más…", { n: changed.length - 8 })}</li>}
          </ul>
        }
        confirmLabel={tr("Guardar")}
        pending={pending}
        onConfirm={save}
        onCancel={() => setAsking(false)}
      />
    </form>
  );
}
