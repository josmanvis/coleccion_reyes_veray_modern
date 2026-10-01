import Link from "next/link";
import { allValuations, pct } from "@/lib/inventory/market";
import ValuationsTable, { type ValuationRow } from "@/components/inventory/ValuationsTable";
import { getTr } from "@/lib/i18n-server";
import { BTN, MUTED } from "@/components/inventory/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const tr = await getTr();
  return { title: tr("Valoraciones · Inventario") };
}

export default async function ValuationsPage() {
  const tr = await getTr();
  const { valuations, rules } = allValuations();

  const rows: ValuationRow[] = valuations.map((v) => ({
    ref: v.ref,
    registro: v.registro,
    title: v.title,
    artist: v.artistName,
    artistSlug: v.artistSlug,
    kind: v.kind,
    recorded: v.recorded,
    purchase: v.purchase,
    suggested: v.suggested,
    basis: v.basis,
    confidence: v.confidence,
    inCollection: v.inCollection,
    hot: v.hot,
  }));

  return (
    <main className="mx-auto max-w-[1400px] px-5 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div>
          <h1 className="text-3xl leading-none">{tr("Valoraciones")}</h1>
          <p className={`mt-1.5 max-w-[80ch] text-sm ${MUTED}`}>
            {tr("Precio sugerido de cada obra: ventas recientes del artista (últimos {years} años, mismo tipo de obra) o, sin ellas, el precio de compra; +{rate} anual; ×{death} si el artista murió después de esa venta; ×{hot} si está en alza. No cambia el «Valor actual» registrado.", {
              years: rules.recentYears,
              rate: pct(rules.annualRate),
              death: rules.deathMultiplier,
              hot: rules.hotMultiplier,
            })}
          </p>
        </div>
        <Link href="/admin/settings#valoracion" className={BTN}>
          {tr("Ajustar reglas")}
        </Link>
      </div>
      <ValuationsTable rows={rows} />
    </main>
  );
}
