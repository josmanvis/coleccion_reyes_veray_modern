"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FIELDS } from "@/lib/inventory/fields";
import ArtworkFieldGrid, { type Values } from "./ArtworkFieldGrid";
import ConfirmDialog from "./ConfirmDialog";
import { useToast } from "./ToastProvider";

const EMPTY: Values = Object.fromEntries(FIELDS.map((f) => [f.key, ""]));

/** Nothing is read-only when creating — the registro number has to be typed. */
const NONE: ReadonlySet<string> = new Set();

export default function NewArtworkForm({ suggestedRegistro }: { suggestedRegistro: string }) {
  const router = useRouter();
  const { notify } = useToast();
  const [asking, setAsking] = useState(false);
  const [values, setValues] = useState<Values>({ ...EMPTY, registro: suggestedRegistro });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filled = FIELDS.filter((f) => (values[f.key] ?? "").trim() !== "").length;
  const canSave = (values.registro ?? "").trim() !== "" && !pending;

  function set(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function requestCreate(event: React.FormEvent) {
    event.preventDefault();
    if (canSave) setAsking(true);
  }

  async function create() {
    setPending(true);
    setError(null);

    const response = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      notify(`Obra CRV #${body.registro} creada`);
      // The server allocates the ref, which is what every admin URL is keyed on.
      router.push(`/admin/artwork/${encodeURIComponent(body.ref)}`);
      router.refresh();
    } else {
      setError(body.error || "No se pudo crear la obra");
      notify(body.error || "No se pudo crear la obra", "error");
      setPending(false);
      setAsking(false);
    }
  }

  return (
    <form onSubmit={requestCreate}>
      <div className="sticky top-[var(--admin-header-h)] z-30 -mx-5 mb-6 flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-[#fdfcfc]/95 px-5 py-3 backdrop-blur">
        <span className="text-sm text-neutral-600">
          {filled} campo{filled === 1 ? "" : "s"} con contenido
        </span>
        {error && <span className="text-sm text-red-600">{error}</span>}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition hover:border-neutral-600"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="rounded bg-black px-4 py-1.5 text-sm text-white transition hover:bg-neutral-700 disabled:opacity-40"
          >
            {pending ? "Creando…" : "Crear obra"}
          </button>
        </div>
      </div>

      <p className="mb-6 rounded border border-neutral-200 bg-white px-4 py-3 text-xs text-neutral-600">
        Solo el <span className="font-mono">#&nbsp;Registro</span> es obligatorio; el resto se puede
        completar después. Si el número ya existe, la obra se añade igual y recibe su propia
        referencia interna — así se registran los portafolios que comparten número.
      </p>

      <ArtworkFieldGrid
        values={values}
        initial={EMPTY}
        onChange={set}
        readOnlyKeys={NONE}
        showDirty={false}
      />

      <ConfirmDialog
        open={asking}
        title="¿Crear esta obra?"
        body={`Se añadirá una ficha nueva con ${filled} campo${filled === 1 ? "" : "s"} completado${
          filled === 1 ? "" : "s"
        }.`}
        detail={
          <>
            # Registro: {values.registro || "(vacío)"}
            {values.title ? ` · ${values.title}` : ""}
          </>
        }
        confirmLabel="Crear obra"
        pending={pending}
        onConfirm={create}
        onCancel={() => setAsking(false)}
      />
    </form>
  );
}
