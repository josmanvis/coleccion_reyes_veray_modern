"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, FileSpreadsheet, Trash2, X } from "lucide-react";
import { BTN, BTN_DANGER, BTN_PRIMARY, CARD, MUTED } from "./ui";
import { useToast } from "./ToastProvider";
import ConfirmDialog from "./ConfirmDialog";
import { useTr } from "@/components/I18nProvider";

type FieldDiff = { key: string; label: string; before: string; after: string };
type Change = {
  id: number;
  ref: string;
  registro: string | null;
  kind: "new" | "update";
  title: string | null;
  artist: string | null;
  status: "pending" | "applied" | "skipped";
  diff: FieldDiff[];
};
type Session = {
  id: number;
  filename: string;
  created_at: string;
  counts: { total: number; nuevas: number; cambios: number; pending: number; applied: number };
};

/**
 * Review screen for a FileMaker export: every record the file would change is
 * listed with its before/after, and nothing is written until it is ticked and
 * confirmed. Approving in bulk is possible, but it is still an explicit act.
 */
export default function ImportReview({
  session,
  changes,
}: {
  session: Session | null;
  changes: Change[];
}) {
  const tr = useTr();
  const router = useRouter();
  const { notify } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [asking, setAsking] = useState<"apply" | "discard" | null>(null);

  const waiting = changes.filter((c) => c.status === "pending");

  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setPending(true);
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/admin/import/preview", { method: "POST", body });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      notify(tr("{v} cambios para revisar", { v: data.session?.counts?.total ?? 0 }));
      router.refresh();
    } else {
      notify(tr(data.error || "No se pudo leer el archivo"), "error");
    }
    setPending(false);
  }

  async function post(action: "apply" | "skip" | "discard", changeIds: number[] = []) {
    setPending(true);
    const response = await fetch("/api/admin/import/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session?.id, action, changeIds }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      if (action === "apply") notify(tr("{n} registro(s) actualizados", { n: data.applied }));
      if (action === "skip") notify(tr("{skipped} descartados de la revisión", { skipped: data.skipped }));
      if (action === "discard") notify(tr("Revisión descartada"));
      setSelected(new Set());
      router.refresh();
    } else {
      notify(tr(data.error || "No se pudo completar"), "error");
    }
    setPending(false);
    setAsking(null);
  }

  return (
    <div className="space-y-4">
      <section className={`${CARD} p-4`}>
        <h2 className="text-sm font-semibold">{tr("Archivo de FileMaker")}</h2>
        <p className={`mt-1 text-sm ${MUTED}`}>
          
          {tr("Exporta desde FileMaker en .xlsx (Records → Show All Records primero). Se compara con los registros y no se escribe nada hasta que confirmes cada cambio.")}
        </p>
        <form onSubmit={upload} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept=".xlsx,.xlsm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="max-w-[300px] text-xs file:mr-3 file:rounded-[var(--radius)] file:border file:border-[var(--stroke)] file:bg-[var(--surface)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[var(--ink-1)]"
          />
          <button type="submit" disabled={!file || pending} className={BTN_PRIMARY}>
            <FileSpreadsheet size={15} strokeWidth={1.75} aria-hidden />
            {pending ? tr("Comparando…") : tr("Comparar con los registros")}
          </button>
        </form>
      </section>

      {session && (
        <section className={CARD}>
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--stroke-soft)] px-4 py-3">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">{session.filename}</h2>
              <p className={`mt-0.5 text-xs ${MUTED}`}>
                {tr("{a} cambios · {b} nuevas · {c} actualizaciones · {d} aplicados", {
                  a: session.counts.total,
                  b: session.counts.nuevas,
                  c: session.counts.cambios,
                  d: session.counts.applied,
                })}
              </p>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelected(new Set(waiting.map((c) => c.id)))}
                disabled={waiting.length === 0}
                className={BTN}
              >
                {tr("Seleccionar todo ({n})", { n: waiting.length })}
              </button>
              <button
                type="button"
                onClick={() => post("skip", [...selected])}
                disabled={selected.size === 0 || pending}
                className={BTN}
              >
                <X size={15} strokeWidth={1.75} aria-hidden />
                
                {tr("Descartar selección")}
              </button>
              <button
                type="button"
                onClick={() => setAsking("apply")}
                disabled={selected.size === 0 || pending}
                className={BTN_PRIMARY}
              >
                <Check size={15} strokeWidth={1.75} aria-hidden />
                {selected.size > 0 ? tr("Aplicar ({n})", { n: selected.size }) : tr("Aplicar")}
              </button>
              <button type="button" onClick={() => setAsking("discard")} className={BTN_DANGER}>
                <Trash2 size={15} strokeWidth={1.75} aria-hidden />
                
                {tr("Descartar revisión")}
              </button>
            </div>
          </div>

          <ul className="divide-y divide-[var(--stroke-soft)]">
            {changes.map((change) => {
              const open = expanded.has(change.id);
              const done = change.status !== "pending";
              return (
                <li key={change.id} className={done ? "opacity-55" : ""}>
                  <div className="flex items-center gap-3 px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(change.id)}
                      disabled={done}
                      onChange={() => toggle(change.id)}
                      aria-label={tr("Seleccionar {id}", { id: change.registro ?? change.ref })}
                      className="size-4 accent-[var(--brand)]"
                    />
                    <span
                      className={`w-[86px] shrink-0 rounded-[var(--radius)] border px-2 py-0.5 text-center text-xs font-semibold ${
                        change.kind === "new"
                          ? "border-[color:var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)]"
                          : "border-[color:var(--brand)]/30 bg-[var(--brand-soft)] text-[var(--brand-hover)]"
                      }`}
                    >
                      {change.kind === "new" ? tr("Nueva") : tr("Cambio")}
                    </span>
                    <span className="font-mono text-xs text-[var(--ink-3)]">
                      {change.registro ?? change.ref}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {change.title || tr("Sin título")}
                      {change.artist && <span className={`ml-2 text-xs ${MUTED}`}>{change.artist}</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((current) => {
                          const next = new Set(current);
                          if (next.has(change.id)) next.delete(change.id);
                          else next.add(change.id);
                          return next;
                        })
                      }
                      className="shrink-0 text-xs font-semibold text-[var(--brand-hover)] hover:underline"
                    >
                      {tr(change.diff.length === 1 ? "{n} campo" : "{n} campos", { n: change.diff.length })}
                    </button>
                    {done && (
                      <span className={`shrink-0 text-xs ${MUTED}`}>
                        {change.status === "applied" ? tr("Aplicado") : tr("Descartado")}
                      </span>
                    )}
                  </div>

                  {open && (
                    <div className="border-t border-[var(--stroke-soft)] bg-[var(--surface-alt)] px-4 py-2">
                      <table className="w-full text-xs">
                        <tbody>
                          {change.diff.map((entry) => (
                            <tr key={entry.key} className="align-top">
                              <td className="w-[180px] py-1 pr-3 font-semibold text-[var(--ink-2)]">
                                {entry.label}
                              </td>
                              <td className="py-1 pr-3 text-[var(--danger)] line-through">
                                {entry.before || tr("(vacío)")}
                              </td>
                              <td className="py-1 text-[var(--success)]">{entry.after || tr("(vacío)")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={asking === "apply"}
        title={tr("¿Aplicar los cambios seleccionados?")}
        body={tr("Se escribirán {size} registro(s) en el inventario.", { size: selected.size })}
        confirmLabel={tr("Aplicar")}
        pending={pending}
        onConfirm={() => post("apply", [...selected])}
        onCancel={() => setAsking(null)}
      />
      <ConfirmDialog
        open={asking === "discard"}
        title={tr("¿Descartar toda la revisión?")}
        body={tr("Se elimina la comparación. Los registros no cambian.")}
        confirmLabel={tr("Descartar")}
        tone="danger"
        pending={pending}
        onConfirm={() => post("discard")}
        onCancel={() => setAsking(null)}
      />
    </div>
  );
}
