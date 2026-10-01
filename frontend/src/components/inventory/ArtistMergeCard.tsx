"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MergeScope } from "@/lib/inventory/artists";
import { useTr } from "@/components/I18nProvider";

export type MergeCardVariant = {
  artist_last: string;
  artist_first?: string | null;
  count: number;
  /** Extra context under the spelling — the first names filed under an apellido. */
  detail?: string;
};

type Props = {
  scope: MergeScope;
  title: string;
  hint?: string;
  variants: MergeCardVariant[];
  total: number;
  /** Suggestions are guesses, so they are framed differently from real duplicates. */
  tone?: "duplicate" | "suggestion";
};

/**
 * Some names carry a stray newline or tab from the spreadsheet. HTML collapses
 * those to a plain space, so two different spellings would render identically
 * and the choice would be a coin flip — show the character instead.
 */
function visible(value: string): string {
  return value
    .replace(/\r\n|\r|\n/g, "↵")
    .replace(/\t/g, "⇥")
    .replace(/\u00a0/g, "␣");
}

function label(variant: MergeCardVariant, scope: MergeScope): string {
  const parts =
    scope === "surname" ? [variant.artist_last] : [variant.artist_last, variant.artist_first];
  return visible(parts.filter(Boolean).join(", "));
}

function identity(variant: MergeCardVariant, scope: MergeScope): string {
  return JSON.stringify(
    scope === "surname" ? [variant.artist_last] : [variant.artist_last, variant.artist_first ?? ""]
  );
}

/** Stray whitespace is invisible in the list, so it gets called out by name. */
function whitespaceWarning(variant: MergeCardVariant): string | null {
  const values = [variant.artist_last, variant.artist_first ?? ""];
  const has = (pattern: RegExp) => values.some((v) => pattern.test(v));
  if (has(/[\n\r]/)) return "salto de línea";
  if (has(/\t/)) return "tabulador";
  if (has(/\u00a0/)) return "espacio duro";
  if (values.some((v) => v !== v.trim())) return "espacios sobrantes";
  if (has(/ {2,}/)) return "espacios dobles";
  return null;
}

export default function ArtistMergeCard({
  scope,
  title,
  hint,
  variants,
  total,
  tone = "duplicate",
}: Props) {
  const tr = useTr();
  const router = useRouter();
  const [chosen, setChosen] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = variants.find((v) => identity(v, scope) === chosen) ?? null;
  const affected = selected ? total - selected.count : 0;

  async function apply() {
    if (!selected) return;
    setPending(true);
    setError(null);

    const response = await fetch("/api/admin/artists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope,
        variants: variants.map((v) => ({
          artist_last: v.artist_last,
          artist_first: v.artist_first ?? null,
        })),
        canonical: {
          artist_last: selected.artist_last,
          artist_first: selected.artist_first ?? null,
        },
      }),
    });

    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      setDone(body.updated ?? 0);
      setChosen(null);
      router.refresh();
    } else {
      setError(tr(body.error || "No se pudo unificar"));
    }
    setPending(false);
  }

  return (
    <article
      className={`rounded border bg-[var(--surface)] px-4 py-3 ${
        tone === "suggestion" ? "border-dashed border-[var(--stroke)]" : "border-[var(--stroke-soft)]"
      }`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-lg leading-tight">{title}</h3>
        <p className="shrink-0 text-xs text-[var(--ink-3)]">
          {tr("{n} grafías", { n: variants.length })} · {tr(total === 1 ? "{n} obra" : "{n} obras", { n: total })}
        </p>
      </header>
      {hint && <p className="mt-0.5 text-xs text-[var(--ink-3)]">{hint}</p>}

      <ul className="mt-3 space-y-1.5">
        {variants.map((variant, index) => {
          const id = identity(variant, scope);
          const isChosen = id === chosen;
          const warning = whitespaceWarning(variant);
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => {
                  setChosen(isChosen ? null : id);
                  setDone(null);
                  setError(null);
                }}
                aria-pressed={isChosen}
                className={`flex w-full items-center gap-3 rounded border px-3 py-2 text-left text-sm transition ${
                  isChosen ? "border-black bg-[var(--hover)]" : "border-[var(--stroke-soft)] hover:bg-[var(--hover)]"
                }`}
              >
                <span
                  aria-hidden
                  className={`size-3.5 shrink-0 rounded-full border ${
                    isChosen ? "border-[5px] border-black" : "border-[var(--stroke)]"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{label(variant, scope)}</span>
                  {variant.detail && (
                    <span className="mt-0.5 block truncate text-xs text-[var(--ink-3)]">
                      {visible(variant.detail)}
                    </span>
                  )}
                </span>
                {index === 0 && (
                  <span className="shrink-0 rounded bg-[var(--hover)] px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-[var(--ink-3)]">
                    
                    {tr("más usada")}
                  </span>
                )}
                {warning && (
                  <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-amber-800">
                    {warning}
                  </span>
                )}
                <span className="w-10 shrink-0 text-right tabular-nums text-[var(--ink-3)]">
                  {variant.count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={apply}
          disabled={!selected || pending || affected === 0}
          className="rounded bg-[var(--brand)] px-3 py-1.5 text-sm text-white transition hover:bg-[var(--brand-hover)] disabled:opacity-40"
        >
          {pending
            ? tr("Unificando…")
            : selected
              ? tr(affected === 1 ? "Usar esta grafía en {n} obra" : "Usar esta grafía en {n} obras", { n: affected })
              : tr("Elige la grafía correcta")}
        </button>
        {done !== null && (
          <span className="text-sm text-emerald-700">
            {tr(done === 1 ? "{n} obra actualizada" : "{n} obras actualizadas", { n: done })}
          </span>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </article>
  );
}
