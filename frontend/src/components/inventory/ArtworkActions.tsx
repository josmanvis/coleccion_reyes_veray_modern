"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deaccessionStatus, IN_INVENTORY_STATUS } from "@/lib/inventory/fields";
import SaleToggle from "./SaleToggle";
import ConfirmDialog from "./ConfirmDialog";
import { useToast } from "./ToastProvider";
import { useTr } from "@/components/I18nProvider";
import { useDeletedToast } from "./trash-client";

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
  const tr = useTr();
  const router = useRouter();
  const { notify } = useToast();
  const deletedToast = useDeletedToast();

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
          ? tr("CRV #{registro} de-accessada", { registro })
          : tr("CRV #{registro} devuelta al inventario", { registro })
      );
      setShowNote(false);
      setNote("");
      router.refresh();
    } else {
      const body = await response.json().catch(() => ({}));
      notify(tr(body.error || "No se pudo cambiar el estatus"), "error");
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
      const { trashId } = await response.json().catch(() => ({}));
      deletedToast(tr("CRV #{n} enviada a la papelera", { n: registro }), trashId, (href) => {
        if (href) router.push(href);
      });
      router.push("/inventory");
      router.refresh();
    } else {
      const body = await response.json().catch(() => ({}));
      notify(tr(body.error || "No se pudo eliminar"), "error");
      setPending(false);
      setAsking(null);
    }
  }

  const buttonBase =
    "rounded border px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40";

  return (
    <div className="space-y-8">
      <section>
        <Heading>{tr("Venta")}</Heading>
        <div className="mt-3">
          <SaleToggle refId={refId} registro={registro} sales={sales} initial={forSale} />
        </div>
      </section>

      <section>
        <Heading>{tr("Estatus")}</Heading>
        <p className="mt-2 text-sm text-[var(--ink-3)]">
          {deaccessed
            ? tr("Esta obra está fuera del inventario.")
            : tr("Al de-accessar, la obra sale del inventario activo y de la galería pública.")}
          {status && <span className="ml-1 text-[var(--ink-1)]">{tr("Actual: {status}", { status })}</span>}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {deaccessed ? (
            <button
              type="button"
              onClick={() => setAsking("reinstate")}
              disabled={pending}
              className={`${buttonBase} border-[var(--stroke)] text-[var(--ink-1)] hover:bg-[var(--hover)] focus-visible:outline-[var(--brand)]`}
            >
              
              {tr("Devolver a inventario")}
            </button>
          ) : showNote ? (
            <>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={tr("Motivo o destino (opcional)")}
                autoFocus
                className="w-64 rounded border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink-1)] outline-none transition placeholder:text-[var(--ink-4)] focus:border-[var(--brand)]"
              />
              <button
                type="button"
                onClick={() => setAsking("deaccession")}
                disabled={pending}
                className={`${buttonBase} border-[var(--brand)] bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] focus-visible:outline-[var(--brand)]`}
              >
                
                {tr("De-accessar")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNote(false);
                  setNote("");
                }}
                className="rounded px-2 py-2 text-sm text-[var(--ink-3)] transition hover:text-[var(--ink-1)]"
              >
                
                {tr("Cancelar")}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowNote(true)}
              className={`${buttonBase} border-[var(--stroke)] text-[var(--ink-1)] hover:bg-[var(--hover)] focus-visible:outline-[var(--brand)]`}
            >
              
              {tr("De-accessar")}
            </button>
          )}
        </div>
      </section>

      <section>
        <Heading>{tr("Eliminar")}</Heading>
        <p className="mt-2 text-sm text-[var(--ink-3)]">
          
          {tr("Envía la ficha a la papelera, desde donde se puede restaurar. Para retirar una obra de la colección conservando su historial, usa de-accession.")}
        </p>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => setAsking("delete")}
            disabled={pending}
            className={`${buttonBase} border-red-300 text-red-800 hover:border-red-500 hover:bg-red-50 focus-visible:outline-red-700`}
          >
            
            {tr("Eliminar obra")}
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={asking === "deaccession"}
        title={tr("¿De-accessar esta obra?")}
        body={tr("CRV #{n} saldrá del inventario activo y dejará de aparecer en la galería pública.", { n: registro })}
        detail={tr("Estatus: \"{status}\"", { status: deaccessionStatus(note) })}
        confirmLabel={tr("De-accessar")}
        pending={pending}
        onConfirm={() => changeStatus("deaccession")}
        onCancel={() => setAsking(null)}
      />

      <ConfirmDialog
        open={asking === "reinstate"}
        title={tr("¿Devolver al inventario?")}
        body={tr("CRV #{n} volverá a contarse como parte de la colección activa.", { n: registro })}
        detail={tr("Estatus: \"{status}\"", { status: IN_INVENTORY_STATUS })}
        confirmLabel={tr("Devolver")}
        pending={pending}
        onConfirm={() => changeStatus("reinstate")}
        onCancel={() => setAsking(null)}
      />

      <ConfirmDialog
        open={asking === "delete"}
        title={tr("¿Eliminar CRV #{registro}?", { registro })}
        body={tr("La ficha va a la papelera; se puede restaurar desde allí.")}
        tone="danger"
        confirmLabel={tr("Sí, eliminar")}
        pending={pending}
        onConfirm={remove}
        onCancel={() => setAsking(null)}
      />
    </div>
  );
}
