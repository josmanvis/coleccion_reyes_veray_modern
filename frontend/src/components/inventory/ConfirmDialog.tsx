"use client";

import { useEffect, useRef } from "react";

export type ConfirmTone = "default" | "danger";

/**
 * Blocking confirmation for anything that writes to the collection. Accidental
 * clicks on a row toggle are how the Ventas column drifted, so the dialog spells
 * out the exact before/after rather than asking a generic "are you sure?".
 */
export default function ConfirmDialog({
  open,
  title,
  body,
  detail,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default",
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  /** The concrete change, e.g. `Ventas: "v" → "V1"`. */
  detail?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <button
        type="button"
        aria-label={cancelLabel}
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-neutral-950/40 backdrop-blur-[2px]"
      />

      <div className="relative w-full max-w-md rounded-lg border border-neutral-300 bg-white p-5 shadow-2xl">
        <h2 id="confirm-title" className="font-serif text-xl leading-tight text-neutral-900">
          {title}
        </h2>

        {body && <div className="mt-2 text-sm leading-relaxed text-neutral-600">{body}</div>}

        {detail && (
          <div className="mt-3 rounded border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-700">
            {detail}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-500 hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`rounded px-4 py-2 text-sm font-medium text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40 ${
              tone === "danger"
                ? "bg-red-700 hover:bg-red-800 focus-visible:outline-red-700"
                : "bg-neutral-900 hover:bg-neutral-700 focus-visible:outline-neutral-900"
            }`}
          >
            {pending ? "Guardando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
