"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deaccessionStatus, IN_INVENTORY_STATUS } from "@/lib/inventory/fields";
import SaleToggle from "./SaleToggle";
import ConfirmDialog from "./ConfirmDialog";
import { useToast } from "./ToastProvider";

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-[var(--stroke)] pb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
      {children}
    </h2>
  );
}

type Pending = "deaccession" | "reinstate" | "delete" | null;

/**
 * State changes that are not ordinary field edits: offering a work for sale,
 * taking it out of the collection, and removing the record entirely. Each one
 * confirms first and reports the result afterwards.
 */
export default function ArtworkActions({
  refId,
  registro,
  sales,
  forSale,
  deaccessed,
  status,
}: {
  refId: string;
  registro: string;
  sales: string | null;
  forSale: boolean;
  deaccessed: boolean;
  status: string | null;
}) {
  const router = useRouter();
  const { notify } = useToast();

  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [asking, setAsking] = useState<Pending>(null);
  const [pending, setPending] = useState(false);

  async function changeStatus(action: "deaccession" | "reinstate") {
    setPending(true);
    const response = await fetch(`/api/inventory/${encodeURIComponent(refId)}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note: action === "deaccession" ? note : undefined }),
    });

    if (response.ok) {
      notify(
        action === "deaccession"
          ? `CRV #${registro} de-accessada`
          : `CRV #${registro} devuelta al inventario`
      );
      setShowNote(false);
      setNote("");
      router.refresh();
    } else {
      const body = await response.json().catch(() => ({}));
      notify(body.error || "No se pudo cambiar el estatus", "error");
    }
    setPending(false);
    setAsking(null);
  }

  async function remove() {
    setPending(true);
    const response = await fetch(`/api/inventory/${encodeURIComponent(refId)}`, {
      method: "DELETE",
    });

    if (response.ok) {
      notify(`CRV #${registro} eliminada`);
      router.push("/inventory");
      router.refresh();
    } else {
      const body = await response.json().catch(() => ({}));
      notify(body.error || "No se pudo eliminar", "error");
      setPending(false);
      setAsking(null);
    }
  }

  const buttonBase =
    "rounded border px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40";

  return (
    <div className="space-y-8">
      <section>
        <Heading>Venta</Heading>
        <div className="mt-3">
          <SaleToggle refId={refId} registro={registro} sales={sales} initial={forSale} />
        </div>
      </section>

      <section>
        <Heading>Estatus</Heading>
        <p className="mt-2 text-sm text-[var(--ink-3)]">
          {deaccessed
            ? "Esta obra está fuera del inventario."
            : "Al de-accessar, la obra sale del inventario activo y de la galería pública."}
          {status && <span className="ml-1 text-[var(--ink-1)]">Actual: {status}</span>}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {deaccessed ? (
            <button
              type="button"
              onClick={() => setAsking("reinstate")}
              disabled={pending}
              className={`${buttonBase} border-[var(--stroke)] text-[var(--ink-1)] hover:bg-[var(--hover)] focus-visible:outline-[var(--brand)]`}
            >
              Devolver a inventario
            </button>
          ) : showNote ? (
            <>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Motivo o destino (opcional)"
                autoFocus
                className="w-64 rounded border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink-1)] outline-none transition placeholder:text-[var(--ink-4)] focus:border-[var(--brand)]"
              />
              <button
                type="button"
                onClick={() => setAsking("deaccession")}
                disabled={pending}
                className={`${buttonBase} border-[var(--brand)] bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] focus-visible:outline-[var(--brand)]`}
              >
                De-accessar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNote(false);
                  setNote("");
                }}
                className="rounded px-2 py-2 text-sm text-[var(--ink-3)] transition hover:text-[var(--ink-1)]"
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowNote(true)}
              className={`${buttonBase} border-[var(--stroke)] text-[var(--ink-1)] hover:bg-[var(--hover)] focus-visible:outline-[var(--brand)]`}
            >
              De-accessar
            </button>
          )}
        </div>
      </section>

      <section>
        <Heading>Eliminar</Heading>
        <p className="mt-2 text-sm text-[var(--ink-3)]">
          Borra la ficha de la base de datos. No se puede deshacer — para retirar una obra de la
          colección conservando su historial, usa de-accession.
        </p>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => setAsking("delete")}
            disabled={pending}
            className={`${buttonBase} border-red-300 text-red-800 hover:border-red-500 hover:bg-red-50 focus-visible:outline-red-700`}
          >
            Eliminar obra
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={asking === "deaccession"}
        title="¿De-accessar esta obra?"
        body={`CRV #${registro} saldrá del inventario activo y dejará de aparecer en la galería pública.`}
        detail={<>Estatus: &quot;{deaccessionStatus(note)}&quot;</>}
        confirmLabel="De-accessar"
        pending={pending}
        onConfirm={() => changeStatus("deaccession")}
        onCancel={() => setAsking(null)}
      />

      <ConfirmDialog
        open={asking === "reinstate"}
        title="¿Devolver al inventario?"
        body={`CRV #${registro} volverá a contarse como parte de la colección activa.`}
        detail={<>Estatus: &quot;{IN_INVENTORY_STATUS}&quot;</>}
        confirmLabel="Devolver"
        pending={pending}
        onConfirm={() => changeStatus("reinstate")}
        onCancel={() => setAsking(null)}
      />

      <ConfirmDialog
        open={asking === "delete"}
        title={`¿Eliminar CRV #${registro} para siempre?`}
        body="La ficha se borra de la base de datos y no se puede recuperar salvo volviendo a importar la hoja de cálculo."
        tone="danger"
        confirmLabel="Sí, eliminar"
        pending={pending}
        onConfirm={remove}
        onCancel={() => setAsking(null)}
      />
    </div>
  );
}
