"use client";

import { useEffect, useState } from "react";
import InteractiveCanvas from "./InteractiveCanvas";

/**
 * The zoomable canvas listens for wheel events on `window` and cancels them, so
 * it cannot live inline on a page that scrolls. It opens as an overlay instead,
 * where taking over the wheel is what the visitor asked for.
 */
export default function ViewingRoom({
  src,
  alt,
  openLabel,
  hint,
  closeLabel,
}: {
  src: string;
  alt: string;
  openLabel: string;
  hint: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-display text-[10px] uppercase tracking-widest opacity-50 transition-opacity hover:opacity-100"
      >
        {openLabel} →
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] bg-neutral-100">
          <div className="absolute inset-0 cursor-move overflow-hidden">
            <InteractiveCanvas src={src} alt={alt} />
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-6 md:p-10">
            <span className="font-display text-[10px] uppercase tracking-widest opacity-40">
              {hint}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="pointer-events-auto rounded-full border border-black/10 bg-white/70 px-4 py-2 font-display text-[10px] uppercase tracking-widest backdrop-blur transition-colors hover:bg-white"
            >
              {closeLabel}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
