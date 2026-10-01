"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Minus, Plus, X } from "lucide-react";
import { BTN_SUBTLE, MUTED } from "./ui";
import { useTr } from "@/components/I18nProvider";

export type ViewableCertificate = {
  id: number;
  /** "Certificado de <tipo> CRV <n>". */
  name: string;
  ext: string | null;
  hasFile: boolean;
  /** Text registered for certificates issued before files were kept. */
  bodyText: string | null;
};

const ZOOMS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 2];

/**
 * Reads a certificate inside OORC instead of downloading it. PDFs use the
 * built-in viewer; Word files (.docx/.dotx, nearly all of the register) are
 * laid out as pages by docx-preview, which runs only in the browser and is
 * loaded on first use. A certificate without a file shows its registered text.
 */
export default function CertificateViewer({
  certificate,
  position,
  onClose,
  onPrevious,
  onNext,
}: {
  certificate: ViewableCertificate | null;
  /** "3 de 12", when the viewer can step through a list. */
  position?: string;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const tr = useTr();
  const [zoom, setZoom] = useState(1);

  // Keyboard handlers read the latest callbacks without re-subscribing.
  const keys = useRef({ onClose, onPrevious, onNext });
  useEffect(() => {
    keys.current = { onClose, onPrevious, onNext };
  });

  const open = certificate !== null;
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      const { onClose, onPrevious, onNext } = keys.current;
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft" && onPrevious) onPrevious();
      else if (event.key === "ArrowRight" && onNext) onNext();
      else if ((event.metaKey || event.ctrlKey) && (event.key === "=" || event.key === "+")) {
        event.preventDefault();
        setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)]);
      } else if ((event.metaKey || event.ctrlKey) && event.key === "-") {
        event.preventDefault();
        setZoom((z) => ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)]);
      } else if ((event.metaKey || event.ctrlKey) && event.key === "0") {
        event.preventDefault();
        setZoom(1);
      }
    }
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  if (!certificate) return null;

  const fileUrl = `/api/admin/certificates/${certificate.id}/file`;
  const isPdf = certificate.hasFile && certificate.ext === "pdf";
  const isWord = certificate.hasFile && (certificate.ext === "docx" || certificate.ext === "dotx");

  return (
    <div className="fixed inset-0 z-[65] flex flex-col bg-[#1f1f1f]/80 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label={certificate.name}>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-black/30 bg-[var(--surface)] px-3">
        {(onPrevious || onNext) && (
          <div className="flex items-center">
            <button type="button" className={BTN_SUBTLE} onClick={onPrevious} disabled={!onPrevious} title={tr("Anterior")}>
              <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
              <span className="sr-only">{tr("Anterior")}</span>
            </button>
            <button type="button" className={BTN_SUBTLE} onClick={onNext} disabled={!onNext} title={tr("Siguiente")}>
              <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
              <span className="sr-only">{tr("Siguiente")}</span>
            </button>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--ink-1)]">{certificate.name}</p>
          <p className={`truncate text-xs ${MUTED}`}>
            {[certificate.ext?.toUpperCase() ?? tr("sin archivo"), position].filter(Boolean).join(" · ")}
          </p>
        </div>

        {!isPdf && (
          <div className="flex items-center gap-0.5" role="group" aria-label={tr("Zoom")}>
            <button
              type="button"
              className={BTN_SUBTLE}
              onClick={() => setZoom((z) => ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)])}
              disabled={zoom === ZOOMS[0]}
              title={tr("Reducir")}
            >
              <Minus size={15} strokeWidth={1.75} aria-hidden />
              <span className="sr-only">{tr("Reducir")}</span>
            </button>
            <button type="button" className={`${BTN_SUBTLE} w-16 tabular-nums`} onClick={() => setZoom(1)} title={tr("Tamaño real")}>
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              className={BTN_SUBTLE}
              onClick={() => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)])}
              disabled={zoom === ZOOMS[ZOOMS.length - 1]}
              title={tr("Ampliar")}
            >
              <Plus size={15} strokeWidth={1.75} aria-hidden />
              <span className="sr-only">{tr("Ampliar")}</span>
            </button>
          </div>
        )}

        {certificate.hasFile && (
          <a href={fileUrl} className={BTN_SUBTLE}>
            <Download size={15} strokeWidth={1.75} aria-hidden />
            {tr("Descargar")}
          </a>
        )}
        <button type="button" className={BTN_SUBTLE} onClick={onClose} title={tr("Cerrar")}>
          <X size={16} strokeWidth={1.75} aria-hidden />
          <span className="sr-only">{tr("Cerrar")}</span>
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {isPdf ? (
          <iframe key={certificate.id} src={`${fileUrl}?inline=1`} title={certificate.name} className="h-full w-full border-0 bg-white" />
        ) : isWord ? (
          <WordPages key={certificate.id} url={fileUrl} zoom={zoom} fallback={certificate.bodyText} />
        ) : (
          <TextPage key={certificate.id} text={certificate.bodyText} zoom={zoom} />
        )}
      </div>
    </div>
  );
}

function WordPages({ url, zoom, fallback }: { url: string; zoom: number; fallback: string | null }) {
  const tr = useTr();
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ renderAsync }, response] = await Promise.all([import("docx-preview"), fetch(url)]);
        if (!response.ok) throw new Error(String(response.status));
        const blob = await response.blob();
        if (cancelled || !host.current) return;
        host.current.innerHTML = "";
        await renderAsync(blob, host.current, host.current, {
          className: "docx",
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          renderHeaders: true,
          renderFooters: true,
          useBase64URL: true,
        });
        if (!cancelled) setState("ready");
      } catch {
        if (!cancelled) setState("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (state === "failed") {
    return (
      <div>
        <p className="mx-auto mt-6 max-w-[816px] rounded-[var(--radius)] bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--warning)]">
          {tr("No se pudo mostrar el documento de Word; se muestra el texto registrado. Descárgalo para verlo con su formato.")}
        </p>
        <TextPage text={fallback} zoom={zoom} />
      </div>
    );
  }

  return (
    <div className="relative min-h-full">
      {state === "loading" && <p className="absolute inset-x-0 top-10 text-center text-sm text-white/80">{tr("Cargando…")}</p>}
      {/* docx-preview draws grey-backed pages; transparent lets the backdrop show instead. */}
      <div
        ref={host}
        style={{ zoom }}
        className="crv-docx [&_.docx-wrapper]:!bg-transparent [&_.docx-wrapper]:!py-6 [&_section.docx]:shadow-[var(--shadow-16)]"
      />
    </div>
  );
}

function TextPage({ text, zoom }: { text: string | null; zoom: number }) {
  const tr = useTr();
  return (
    <div className="py-6" style={{ zoom }}>
      <article className="mx-auto min-h-[1056px] w-[816px] max-w-full bg-white px-[72px] py-[72px] text-[15px] leading-relaxed text-[#242424] shadow-[var(--shadow-16)]">
        {text ? (
          <pre className="whitespace-pre-wrap font-[inherit]">{text}</pre>
        ) : (
          <p className="text-[#616161]">{tr("Este certificado no tiene archivo ni texto registrado.")}</p>
        )}
      </article>
    </div>
  );
}
