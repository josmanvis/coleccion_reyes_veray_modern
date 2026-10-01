import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { formatMoney } from "@/lib/inventory/fields";
import { SALE_SOURCE_LABELS, WORK_KIND_LABELS, type ArtistMarket, type WorkValuation } from "@/lib/inventory/market";
import { getTr } from "@/lib/i18n-server";
import { MUTED } from "./ui";

export const CONFIDENCE_LABELS = { alta: "Confianza alta", media: "Confianza media", baja: "Confianza baja" } as const;

const CONFIDENCE_TONE = {
  alta: "bg-[var(--success-soft)] text-[var(--success)]",
  media: "bg-[var(--warning-soft)] text-[var(--warning)]",
  baja: "bg-[var(--hover)] text-[var(--ink-3)]",
} as const;

/** Suggested market price for one work, with the steps that produced it. */
export default async function ValuationPanel({
  valuation,
  artist,
}: {
  valuation: WorkValuation;
  artist: ArtistMarket | null;
}) {
  const tr = await getTr();
  const { suggested, recorded } = valuation;
  const diff = suggested && recorded ? suggested / recorded - 1 : null;
  const marketHref = valuation.artistSlug ? `/admin/artists/${valuation.artistSlug}?tab=mercado` : null;
  const others = (artist?.sales ?? []).filter((s) => s.registro !== valuation.registro).slice(0, 4);

  return (
    <section className="mt-6 rounded border border-[var(--stroke-soft)] bg-[var(--surface)] p-4">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
        <TrendingUp size={14} strokeWidth={1.75} aria-hidden />
        {tr("Precio sugerido")}
        {valuation.confidence && (
          <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] normal-case tracking-normal ${CONFIDENCE_TONE[valuation.confidence]}`}>
            {tr(CONFIDENCE_LABELS[valuation.confidence])}
          </span>
        )}
      </h2>

      {suggested === null ? (
        <p className={`mt-2 text-sm ${MUTED}`}>{valuation.notes.map((n) => tr(n.text, n.vars)).join(" ")}</p>
      ) : (
        <>
          <p className="mt-2 text-3xl font-semibold tabular-nums leading-none text-[var(--ink-1)]">{formatMoney(suggested)}</p>
          <p className={`mt-1 text-sm ${MUTED}`}>
            {recorded ? (
              <>
                {tr("Valor registrado {value}", { value: formatMoney(recorded) })}
                {diff !== null && Math.abs(diff) >= 0.005 && (
                  <span className={diff > 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                    {" "}
                    ({diff > 0 ? "+" : ""}
                    {Math.round(diff * 100)}%)
                  </span>
                )}
              </>
            ) : (
              tr("Sin valor registrado")
            )}
          </p>

          <ol className="mt-4 space-y-1.5 border-l border-[var(--stroke)] pl-3 text-sm">
            {valuation.steps.map((step, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0">
                  <span className="text-[var(--ink-2)]">{tr(step.label, step.vars)}</span>
                  {step.detail && <span className={`block text-xs ${MUTED}`}>{step.detail}</span>}
                </span>
                <span className="shrink-0 tabular-nums text-[var(--ink-1)]">{formatMoney(step.value)}</span>
              </li>
            ))}
          </ol>

          {valuation.notes.length > 0 && (
            <ul className={`mt-3 space-y-0.5 text-xs ${MUTED}`}>
              {valuation.notes.map((note) => (
                <li key={note.text}>{tr(note.text, note.vars)}</li>
              ))}
            </ul>
          )}
        </>
      )}

      {valuation.basis !== "mercado" && others.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-[var(--ink-2)]">{tr("Otras ventas del artista (no recientes o de otro tipo)")}</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {others.map((sale, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className={`min-w-0 truncate ${MUTED}`}>
                  {sale.date.slice(0, 4)} · {tr(SALE_SOURCE_LABELS[sale.source])} · {tr(WORK_KIND_LABELS[sale.kind])}
                </span>
                <span className="tabular-nums">{formatMoney(sale.price)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {marketHref && (
        <Link href={marketHref} className="mt-4 inline-block text-xs font-medium text-[var(--brand)] hover:underline">
          {tr("Ventas de mercado de {artist} →", { artist: valuation.artistName })}
        </Link>
      )}
    </section>
  );
}
