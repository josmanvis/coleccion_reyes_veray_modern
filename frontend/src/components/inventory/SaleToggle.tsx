"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FOR_SALE_CODE, withForSale } from "@/lib/inventory/fields";
import ConfirmDialog from "./ConfirmDialog";
import { useToast } from "./ToastProvider";

/**
 * Flips the "Ventas" code that decides whether a work is offered for sale on the
 * public site. The server owns the rewrite rule; this only sends the state it
 * wants, and always asks first — a stray click here is how the column drifted.
 */
export default function SaleToggle({
  refId,
  registro,
  sales,
  initial,
  variant = "full",
}: {
  refId: string;
  registro: string;
  /** Current raw Ventas cell, shown in the confirmation so the change is legible. */
  sales: string | null;
  initial: boolean;
  /** "pill" is the compact form used inside the inventory table. */
  variant?: "full" | "pill";
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [forSale, setForSale] = useState(initial);
  const [current, setCurrent] = useState(sales);
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);

  const next = !forSale;
  const preview = withForSale(current, next);

  async function apply() {
    setPending(true);

    const response = await fetch(`/api/inventory/${encodeURIComponent(refId)}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "for_sale", value: next }),
    });

    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      setForSale(Boolean(body.for_sale));
      setCurrent(body.sales ?? null);
      notify(
        next
          ? `CRV #${registro} marcada en venta (${FOR_SALE_CODE})`
          : `CRV #${registro} ya no está en venta`
      );
      router.refresh();
    } else {
      notify(body.error || "No se pudo cambiar", "error");
    }
    setPending(false);
    setAsking(false);
  }

  const dialog = (
    <ConfirmDialog
      open={asking}
      title={next ? "¿Marcar en venta?" : "¿Quitar de venta?"}
      body={
        next
          ? `La obra CRV #${registro} aparecerá como disponible en el sitio público.`
          : `La obra CRV #${registro} dejará de ofrecerse en el sitio público.`
      }
      detail={
        <>
          Ventas: {current === null ? "(vacío)" : `"${current}"`} →{" "}
          {preview === null ? "(vacío)" : `"${preview}"`}
        </>
      }
      confirmLabel={next ? "Marcar en venta" : "Quitar de venta"}
      pending={pending}
      onConfirm={apply}
      onCancel={() => setAsking(false)}
    />
  );

  if (variant === "pill") {
    return (
      <>
        <button
          type="button"
          onClick={() => setAsking(true)}
          disabled={pending}
          title={forSale ? "En venta — clic para quitar" : "Marcar en venta"}
          aria-pressed={forSale}
          className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--brand)] disabled:opacity-40 ${
            forSale
              ? "border-sky-400 bg-sky-100 text-sky-900 hover:border-sky-600"
              : "border-[var(--stroke)] bg-[var(--surface)] text-[var(--ink-3)] hover:bg-[var(--hover)] hover:text-[var(--ink-1)]"
          }`}
        >
          {pending ? "…" : forSale ? "En venta" : "—"}
        </button>
        {dialog}
      </>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => setAsking(true)}
        disabled={pending}
        aria-pressed={forSale}
        className={`rounded px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:opacity-40 ${
          forSale
            ? "border border-sky-400 bg-sky-100 text-sky-900 hover:border-sky-600"
            : "border border-[var(--stroke)] text-[var(--ink-2)] hover:bg-[var(--hover)]"
        }`}
      >
        {forSale ? "En venta · quitar" : "Marcar en venta"}
      </button>
      <span className="text-xs text-[var(--ink-3)]">
        {forSale
          ? "Aparece como disponible en el sitio público."
          : "No se ofrece en el sitio público."}
        <span className="ml-1 font-mono text-[var(--ink-3)]">
          Ventas: {current === null ? "(vacío)" : current}
        </span>
      </span>
      {dialog}
    </div>
  );
}
