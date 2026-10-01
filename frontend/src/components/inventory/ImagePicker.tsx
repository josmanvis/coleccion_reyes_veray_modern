"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaRow } from "@/lib/inventory/blocks";
import { useToast } from "./ToastProvider";

/**
 * Upload-and-choose dialog shared by every block that takes an image. Uploads
 * go to /api/admin/media, which stores the file under public/uploads and
 * records it, so previously uploaded images stay reusable.
 */
export default function ImagePicker({
  open,
  multiple = false,
  onClose,
  onPick,
}: {
  open: boolean;
  /** Gallery blocks take several images at once. */
  multiple?: boolean;
  onClose: () => void;
  onPick: (urls: string[]) => void;
}) {
  const { notify } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/admin/media");
    const body = await response.json().catch(() => ({}));
    setMedia(Array.isArray(body.media) ? body.media : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      setSelected([]);
      load();
    }
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      setUploading(true);
      const form = new FormData();
      for (const file of list) form.append("file", file);

      const response = await fetch("/api/admin/media", { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));

      if (response.ok) {
        const added: MediaRow[] = body.media ?? [];
        setMedia((current) => [...added, ...current]);
        setSelected((current) =>
          multiple ? [...current, ...added.map((m) => m.url)] : [added[0]?.url].filter(Boolean)
        );
        notify(`${added.length} imagen${added.length === 1 ? "" : "es"} subida${added.length === 1 ? "" : "s"}`);
      } else {
        notify(body.error || "No se pudo subir la imagen", "error");
      }
      setUploading(false);
    },
    [multiple, notify]
  );

  if (!open) return null;

  function toggle(url: string) {
    setSelected((current) => {
      if (current.includes(url)) return current.filter((u) => u !== url);
      return multiple ? [...current, url] : [url];
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Elegir imagen"
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[#242424]/40 backdrop-blur-[2px]"
      />

      <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-[var(--stroke)] bg-[var(--surface)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[var(--stroke-soft)] px-5 py-3">
          <h2 className="text-lg text-[var(--ink-1)]">
            {multiple ? "Elegir imágenes" : "Elegir imagen"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-[var(--ink-3)] transition hover:text-[var(--ink-1)]"
          >
            Cerrar
          </button>
        </header>

        <div className="px-5 pt-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              upload(e.dataTransfer.files);
            }}
            className={`rounded-lg border-2 border-dashed px-4 py-6 text-center transition ${
              dragging ? "border-[var(--brand)] bg-[var(--surface-alt)]" : "border-[var(--stroke)]"
            }`}
          >
            <p className="text-sm text-[var(--ink-2)]">
              Arrastra imágenes aquí o{" "}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-medium text-[var(--ink-1)] underline underline-offset-2"
              >
                búscalas en tu computadora
              </button>
            </p>
            <p className="mt-1 text-xs text-[var(--ink-3)]">JPG, PNG, WebP, AVIF, GIF o SVG · máx. 12 MB</p>
            {uploading && <p className="mt-2 text-sm text-[var(--ink-1)]">Subiendo…</p>}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple={multiple}
              hidden
              onChange={(e) => {
                if (e.target.files) upload(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="py-10 text-center text-sm text-[var(--ink-3)]">Cargando…</p>
          ) : media.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--ink-3)]">
              Todavía no has subido ninguna imagen.
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {media.map((item) => {
                const isOn = selected.includes(item.url);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggle(item.url)}
                      aria-pressed={isOn}
                      className={`block w-full overflow-hidden rounded border-2 transition ${
                        isOn ? "border-[var(--brand)]" : "border-transparent hover:border-[var(--stroke)]"
                      }`}
                    >
                      <span className="relative block aspect-square bg-[var(--hover)]">
                        <Image
                          src={item.url}
                          alt={item.alt ?? ""}
                          fill
                          sizes="160px"
                          className="object-contain"
                          unoptimized
                        />
                      </span>
                      <span className="block truncate px-1 py-1 text-left text-[11px] text-[var(--ink-3)]">
                        {item.filename}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[var(--stroke-soft)] px-5 py-3">
          <p className="text-xs text-[var(--ink-3)]">
            {selected.length > 0
              ? `${selected.length} seleccionada${selected.length === 1 ? "" : "s"}`
              : "Ninguna seleccionada"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-[var(--stroke)] px-3 py-2 text-sm font-medium text-[var(--ink-2)] transition hover:bg-[var(--hover)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={selected.length === 0}
              onClick={() => {
                onPick(selected);
                onClose();
              }}
              className="rounded bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-hover)] disabled:opacity-40"
            >
              Usar
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
