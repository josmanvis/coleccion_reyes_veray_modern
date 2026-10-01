"use client";

import { useEffect, useState } from "react";
import { Award, FileDown, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  CERTIFICATE_COPY,
  CERTIFICATE_TYPES,
  todayISO,
  type CertificateType,
} from "@/lib/inventory/certificates";
import { useToast } from "./ToastProvider";
import ConfirmDialog from "./ConfirmDialog";
import { useTr } from "@/components/I18nProvider";

/**
 * Prints without a download: the PDF is loaded into an off-screen same-origin
 * iframe and that frame is told to print, so the browser's print dialog opens
 * on the certificate itself.
 */
type Desktop = {
  isDesktop: true;
  printPdf: (bytes: Uint8Array, options?: { deviceName?: string; silent?: boolean }) => Promise<{
    success: boolean;
    failureReason?: string;
  }>;
};

function desktop(): Desktop | null {
  if (typeof window === "undefined") return null;
  return ((window as unknown as { crvmgmt?: Desktop }).crvmgmt) ?? null;
}

function printPdf(url: string, onFailure: () => void) {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.src = url;

  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      // Some browsers refuse to print a framed PDF; show it instead so the
      // person can print from the viewer.
      window.open(url, "_blank", "noopener");
      onFailure();
    }
    // Keep the frame alive long enough for the dialog to read it.
    window.setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  };

  document.body.appendChild(frame);
}

const FIELD =
  "w-full rounded border border-[var(--stroke)] bg-[var(--surface)] px-3 py-1.5 text-sm outline-none transition focus:border-[var(--brand)]";

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-xs text-[var(--ink-3)]">{children}</span>;
}

/**
 * Builds one of the three Word certificates the collection issues. Everything
 * is prefilled from the record but stays editable, because the wording on file
 * varies — some certificates carry a translated title, some an exhibition list.
 */
export default function CertificatePanel({
  refId,
  defaults,
  variant = "inline",
}: {
  refId: string;
  /**
   * "drawer" puts the form behind a button in the record's action row, where
   * it is visible without scrolling past the whole ficha.
   */
  variant?: "inline" | "drawer";
  defaults: {
    artist: string;
    title: string;
    medium: string;
    dimensions: string;
    year: string;
    edition: string;
    exhibitions: string;
    publications: string;
  };
}) {
  const tr = useTr();
  const router = useRouter();
  const { notify } = useToast();
  const [type, setType] = useState<CertificateType>("adquisicion");
  const [party, setParty] = useState("");
  const [date, setDate] = useState(todayISO());
  const [values, setValues] = useState(defaults);
  const [pending, setPending] = useState<"download" | "print" | null>(null);
  // Set once the first download succeeds; the second format reuses the same id.
  const [code, setCode] = useState<string | null>(null);
  const [askDeaccession, setAskDeaccession] = useState(false);
  const [deaccessioned, setDeaccessioned] = useState(false);
  const [working, setWorking] = useState(false);
  const [open, setOpen] = useState(variant === "inline");

  useEffect(() => {
    if (variant !== "drawer" || !open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [variant, open]);

  function set(key: keyof typeof defaults, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function run(action: "download" | "print") {
    if (!party.trim()) {
      notify(tr("Indica la persona o entidad"), "error");
      return;
    }
    setPending(action);

    const response = await fetch("/api/admin/certificate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: refId, type, party, date, code, ...values }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      notify(tr(body.error || "No se pudo generar el certificado"), "error");
      setPending(null);
      return;
    }

    const issued = response.headers.get("X-Certificate-Code");
    if (issued) setCode(issued);

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    if (action === "download") {
      const link = document.createElement("a");
      link.href = url;
      link.download = `${CERTIFICATE_COPY[type].heading}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      notify(tr("Certificado {code} descargado", { code: issued ?? "" }).replace("  ", " "));
    } else {
      const shell = desktop();
      if (shell) {
        // CRVMGMT prints straight to the printer; the browser can only offer a
        // dialog, so that path stays as the fallback.
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const printer = await fetch("/api/admin/settings")
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => d?.settings?.["print.defaultPrinter"] || undefined)
          .catch(() => undefined);
        const printed = await shell.printPdf(bytes, { silent: true, deviceName: printer });
        URL.revokeObjectURL(url);
        if (printed.success) {
          notify(tr("Certificado {code} impreso", { code: issued ?? "" }).replace("  ", " "));
        } else {
          notify(printed.failureReason || tr("La impresora rechazó el trabajo"), "error");
        }
      } else {
        printPdf(url, () => notify(tr("No se pudo abrir el diálogo de impresión"), "error"));
        notify(tr("Certificado {v} enviado a la impresora", { v: issued ?? "" }).replace("  ", " "));
      }
    }

    setPending(null);
  }

  /** Reuses the same endpoint the record page uses, so the status text matches. */
  async function deaccession() {
    setWorking(true);
    const note = `${CERTIFICATE_COPY[type].heading.replace("Certificado de ", "")} a ${party.trim()}${
      code ? ` (${code})` : ""
    }`;
    const response = await fetch(`/api/inventory/${encodeURIComponent(refId)}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deaccession", note }),
    });
    if (response.ok) {
      setDeaccessioned(true);
      notify(tr("Obra marcada como de-accessed"));
      router.refresh();
    } else {
      const body = await response.json().catch(() => ({}));
      notify(tr(body.error || "No se pudo cambiar el estatus"), "error");
    }
    setWorking(false);
    setAskDeaccession(false);
  }

  const form = (
    <section>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--stroke-soft)] pb-1.5">
        <h2 className="text-xs uppercase tracking-wide text-[var(--ink-3)]">{tr("Certificado")}</h2>
        {variant === "drawer" && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm text-[var(--ink-2)] underline-offset-2 transition hover:text-[var(--ink-1)] hover:underline"
          >
            
            {tr("Cerrar")}
          </button>
        )}
      </div>

      <>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {CERTIFICATE_TYPES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setType(option)}
            className={`rounded border px-3 py-1.5 text-sm transition ${
              type === option
                ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                : "border-[var(--stroke)] text-[var(--ink-2)] hover:bg-[var(--hover)]"
            }`}
          >
            {tr(CERTIFICATE_COPY[option].heading.replace("Certificado de ", ""))}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <Label>{tr(CERTIFICATE_COPY[type].partyLabel)}</Label>
          <input
            type="text"
            value={party}
            onChange={(e) => setParty(e.target.value)}
            placeholder={tr("Familia Reyes-Becerra")}
            className={FIELD}
          />
        </label>

        <label>
          <Label>{tr("Artista")}</Label>
          <input type="text" value={values.artist} onChange={(e) => set("artist", e.target.value)} className={FIELD} />
        </label>
        <label>
          <Label>{tr("Fecha del certificado")}</Label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={FIELD} />
        </label>

        <label className="sm:col-span-2">
          <Label>{tr("Título (puede incluir la traducción: Ciudades // Cities)")}</Label>
          <input type="text" value={values.title} onChange={(e) => set("title", e.target.value)} className={FIELD} />
        </label>

        <label className="sm:col-span-2">
          <Label>{tr("Técnica y soporte (bilingüe)")}</Label>
          <input type="text" value={values.medium} onChange={(e) => set("medium", e.target.value)} className={FIELD} />
        </label>

        <label>
          <Label>{tr("Dimensiones")}</Label>
          <input
            type="text"
            value={values.dimensions}
            onChange={(e) => set("dimensions", e.target.value)}
            className={FIELD}
          />
        </label>
        <label>
          <Label>{tr("Año")}</Label>
          <input type="text" value={values.year} onChange={(e) => set("year", e.target.value)} className={FIELD} />
        </label>

        <label className="sm:col-span-2">
          <Label>{tr("Edición (se imprime como “Ed. 27/90”; vacío si es pieza única)")}</Label>
          <input
            type="text"
            value={values.edition}
            onChange={(e) => set("edition", e.target.value)}
            placeholder={tr("27/90 · P/A")}
            className={FIELD}
          />
        </label>

        <label className="sm:col-span-2">
          <Label>{tr("Exhibiciones (opcional)")}</Label>
          <textarea
            value={values.exhibitions}
            onChange={(e) => set("exhibitions", e.target.value)}
            rows={2}
            className={FIELD}
          />
        </label>
        <label className="sm:col-span-2">
          <Label>{tr("Publicaciones (opcional)")}</Label>
          <textarea
            value={values.publications}
            onChange={(e) => set("publications", e.target.value)}
            rows={2}
            className={FIELD}
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => run("download")}
          disabled={pending !== null}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-hover)] disabled:opacity-40"
        >
          <FileDown size={15} strokeWidth={1.75} aria-hidden />
          {pending === "download" ? tr("Generando…") : tr("Descargar PDF")}
        </button>
        <button
          type="button"
          onClick={() => run("print")}
          disabled={pending !== null}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--stroke)] px-4 py-2 text-sm font-semibold text-[var(--ink-1)] transition hover:bg-[var(--hover)] disabled:opacity-40"
        >
          <Printer size={15} strokeWidth={1.75} aria-hidden />
          {pending === "print" ? tr("Preparando…") : tr("Imprimir certificado")}
        </button>
        <span className="text-xs text-[var(--ink-3)]">
          
          {tr("Se incluye la imagen de la obra cuando está enlazada.")}
        </span>
      </div>

      {code && (
        <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
          <p>
            {tr("Certificado emitido:")} <span className="font-mono">{code}</span>
          </p>
          {deaccessioned ? (
            <p className="mt-1 text-xs text-emerald-800">
              
              {tr("La obra quedó marcada como de-accessed.")}
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="text-xs text-emerald-800">
                
                {tr("¿La obra sale de la colección con este certificado?")}
              </span>
              <button
                type="button"
                onClick={() => setAskDeaccession(true)}
                className="rounded border border-emerald-300 bg-[var(--surface)] px-3 py-1.5 text-xs text-emerald-900 transition hover:border-emerald-500"
              >
                
                {tr("Marcar como de-accessed")}
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={askDeaccession}
        title={tr("¿Marcar la obra como de-accessed?")}
        body={tr("La obra dejará de contar como parte del inventario. Puedes revertirlo desde la ficha.")}
        detail={
          <>
            {tr("Estatus: \"De-accessed: {detail}\"", {
              detail: `${tr(CERTIFICATE_COPY[type].heading.replace("Certificado de ", ""))} ${tr("a")} ${party.trim()}${code ? ` (${code})` : ""}`,
            })}
          </>
        }
        confirmLabel={tr("Marcar")}
        tone="danger"
        pending={working}
        onConfirm={deaccession}
        onCancel={() => setAskDeaccession(false)}
      />
      </>
    </section>
  );

  if (variant === "inline") return form;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-[var(--stroke)] px-3 py-1.5 text-[var(--ink-1)] transition hover:bg-[var(--hover)] hover:text-[var(--ink-1)]"
      >
        <Award size={15} strokeWidth={1.75} aria-hidden />
        
        {tr("Generar certificado")}
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
            aria-label={tr("Generar certificado")}
            className="relative h-full w-full max-w-[560px] overflow-y-auto border-l border-[var(--stroke)] bg-[var(--surface)] p-5 shadow-xl"
          >
            {form}
          </aside>
        </div>
      )}
    </>
  );
}
