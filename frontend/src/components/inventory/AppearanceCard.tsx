"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Palette, Trash2, Upload } from "lucide-react";
import { ACCENT_PRESETS, accentTokens, initialsOf, normalizeHex } from "@/lib/inventory/theme";
import { BTN, CARD, LABEL, MUTED } from "./ui";
import { useToast } from "./ToastProvider";
import { useTr } from "@/components/I18nProvider";

/**
 * Each person's own accent and picture.
 *
 * Saved on the spot rather than through the page's Guardar button: these
 * belong to the person rather than to CRVMGMT, and the whole point of a colour
 * is seeing it applied.
 *
 * The picture is shrunk to a small square in the browser before it is sent. A
 * phone photo is several megabytes and would otherwise be carried inline with
 * every presence poll; what the bubbles need is 128 pixels.
 */

const AVATAR_PX = 128;

export default function AppearanceCard({
  name,
  accent,
  avatar,
}: {
  name: string;
  accent: string;
  avatar: string | null;
}) {
  const tr = useTr();
  const router = useRouter();
  const { notify } = useToast();
  const [chosen, setChosen] = useState(normalizeHex(accent));
  const [picture, setPicture] = useState<string | null>(avatar);
  const [pending, setPending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function save(patch: { accent?: string; avatar?: string | null }) {
    setPending(true);
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify(tr(data.error || "No se pudo guardar"), "error");
        return false;
      }
      notify(tr("Apariencia actualizada"));
      // The accent lives on the shell, which the server renders.
      router.refresh();
      return true;
    } finally {
      setPending(false);
    }
  }

  async function pickAccent(hex: string) {
    const next = normalizeHex(hex);
    setChosen(next);
    await save({ accent: next });
  }

  /** Draws the picture into a square canvas, cropped to its centre. */
  async function shrink(file: File): Promise<string> {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_PX;
    canvas.height = AVATAR_PX;

    const context = canvas.getContext("2d");
    if (!context) throw new Error(tr("El navegador no pudo procesar la imagen"));
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_PX,
      AVATAR_PX
    );
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!/^image\//.test(file.type)) {
      notify(tr("Elige un archivo de imagen"), "error");
      return;
    }
    try {
      const dataUrl = await shrink(file);
      setPicture(dataUrl);
      if (!(await save({ avatar: dataUrl }))) setPicture(avatar);
    } catch (error) {
      notify(tr((error as Error).message), "error");
    }
  }

  const tokens = accentTokens(chosen);

  return (
    <section className={`${CARD} p-4`}>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Palette size={16} strokeWidth={1.75} aria-hidden />
        
        {tr("Apariencia")}
      </h2>
      <p className={`mt-1 text-sm ${MUTED}`}>
        
        {tr("Tu color y tu imagen. Solo cambian lo que tú ves, y la inicial que ven los demás.")}
      </p>

      <div className="mt-3 flex flex-wrap items-start gap-6">
        <div>
          <span className={LABEL}>{tr("Imagen")}</span>
          <div className="flex items-center gap-2">
            <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-full ring-1 ring-[var(--stroke)]">
              {picture ? (
                // A local data URL; the image optimizer has nothing to add.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={picture} alt="" className="h-14 w-14 object-cover" />
              ) : (
                <span
                  className="grid h-14 w-14 place-items-center text-lg font-semibold text-white"
                  style={{ background: tokens.brand, color: tokens.onBrand }}
                >
                  {initialsOf(name)}
                </span>
              )}
            </span>
            <div className="flex flex-col gap-1.5">
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                onChange={onFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={pending}
                className={BTN}
              >
                <Upload size={14} strokeWidth={1.75} aria-hidden />
                
                {tr("Subir")}
              </button>
              {picture && (
                <button
                  type="button"
                  onClick={async () => {
                    setPicture(null);
                    if (!(await save({ avatar: null }))) setPicture(avatar);
                  }}
                  disabled={pending}
                  className={BTN}
                >
                  <Trash2 size={14} strokeWidth={1.75} aria-hidden />
                  
                  {tr("Quitar")}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="min-w-[260px] flex-1">
          <span className={LABEL}>{tr("Color")}</span>
          <div className="flex flex-wrap gap-1.5">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => void pickAccent(preset.hex)}
                disabled={pending}
                aria-label={tr(preset.label)}
                title={tr(preset.label)}
                className="grid h-8 w-8 place-items-center rounded-full ring-offset-2 transition-transform hover:scale-110 disabled:opacity-60"
                style={{
                  background: preset.hex,
                  boxShadow:
                    normalizeHex(preset.hex) === chosen ? `0 0 0 2px var(--surface), 0 0 0 4px ${preset.hex}` : undefined,
                }}
              >
                {normalizeHex(preset.hex) === chosen && (
                  <Check size={15} strokeWidth={2.5} aria-hidden className="text-white" />
                )}
              </button>
            ))}
          </div>

          <label className="mt-3 flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--ink-2)]">{tr("O el tuyo")}</span>
            <input
              type="color"
              value={chosen}
              onChange={(event) => setChosen(normalizeHex(event.target.value))}
              onBlur={() => void pickAccent(chosen)}
              className="h-8 w-12 cursor-pointer rounded-[var(--radius)] border border-[var(--stroke)] bg-[var(--surface)] p-0.5"
              aria-label={tr("Color personalizado")}
            />
            <code className="font-mono text-xs text-[var(--ink-3)]">{chosen}</code>
          </label>
        </div>
      </div>
    </section>
  );
}
