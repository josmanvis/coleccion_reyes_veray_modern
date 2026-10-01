import Link from "next/link";
import { dataQuality, stats } from "@/lib/inventory/db";
import { artistReview } from "@/lib/inventory/artists";
import {
  STATUS_GROUPS,
  artistName,
  formatMoney,
  formatNumber,
  titleCase,
  type StatusGroup,
} from "@/lib/inventory/fields";
import ImportPanel from "@/components/inventory/ImportPanel";

export const dynamic = "force-dynamic";

export const metadata = { title: "Panel · Inventario" };

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className="rounded border border-[var(--stroke-soft)] bg-[var(--surface)] px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-[var(--ink-3)]">{label}</p>
      <p className="mt-1 text-lg font-semibold leading-none">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--ink-3)]">{hint}</p>}
    </div>
  );
}

export default async function AdminPage() {
  const { totals, byStatus, topArtists, recent } = stats();
  const quality = dataQuality();
  const artists = artistReview();
  const pendingArtists = artists.duplicates.length + artists.surnames.length;

  const inInventory = byStatus.find((s) => s.value === "en_inventario");
  const maxArtistCount = topArtists[0]?.count ?? 1;

  return (
    <main className="mx-auto max-w-[1400px] px-5 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <h1 className="text-3xl leading-none">Panel</h1>
          <p className="mt-1.5 text-sm text-[var(--ink-3)]">
            Base de datos local · {formatNumber(totals.total)} obras
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/artwork/new"
            className="rounded border border-[var(--stroke)] px-3 py-1.5 text-sm text-[var(--ink-1)] transition hover:bg-[var(--hover)] hover:text-[var(--ink-1)]"
          >
            + Nueva obra
          </Link>
          <Link
            href="/inventory"
            className="rounded bg-[var(--brand)] px-3 py-1.5 text-sm text-white transition hover:bg-[var(--brand-hover)]"
          >
            Ir al inventario
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Stat label="Obras" value={formatNumber(totals.total)} />
        <Stat
          label="En inventario"
          value={formatNumber(inInventory?.count ?? 0)}
          hint={formatMoney(inInventory?.value_total ?? 0)}
        />
        <Stat
          label="Artistas"
          value={formatNumber(totals.artists)}
          hint={
            pendingArtists > 0 ? (
              <Link href="/admin/artists" className="text-amber-700 underline-offset-2 hover:underline">
                {formatNumber(pendingArtists)} nombres por revisar
              </Link>
            ) : (
              <Link href="/admin/artists" className="underline-offset-2 hover:underline">
                Nombres unificados
              </Link>
            )
          }
        />
        <Stat
          label="Valor declarado"
          value={formatMoney(totals.value_total)}
          hint={`Compra: ${formatMoney(totals.purchase_total)}`}
        />
        <Stat
          label="En venta"
          value={formatNumber(totals.for_sale)}
          hint={
            <Link href="/inventory?forSale=1" className="underline-offset-2 hover:underline">
              Ver las obras marcadas
            </Link>
          }
        />
        <Stat
          label="Con imagen"
          value={formatNumber(totals.with_image)}
          hint={`${formatNumber(quality.missingImage)} sin enlazar`}
        />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="border-b border-[var(--stroke-soft)] pb-1.5 text-xs uppercase tracking-wide text-[var(--ink-3)]">
            Por estatus
          </h2>
          <ul className="mt-3 space-y-2">
            {byStatus.map((row) => (
              <li key={row.value}>
                <Link
                  href={`/inventory?statusGroup=${row.value}`}
                  className="group flex items-center gap-3 text-sm"
                >
                  <span className="w-32 shrink-0 text-[var(--ink-2)] group-hover:text-[var(--ink-1)]">
                    {STATUS_GROUPS[row.value as StatusGroup] ?? row.value}
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--hover)]">
                    <span
                      className="block h-full rounded-full bg-[var(--brand)]"
                      style={{ width: `${(row.count / totals.total) * 100}%` }}
                    />
                  </span>
                  <span className="w-12 shrink-0 text-right tabular-nums text-[var(--ink-3)]">
                    {row.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <h2 className="mt-8 border-b border-[var(--stroke-soft)] pb-1.5 text-xs uppercase tracking-wide text-[var(--ink-3)]">
            Artistas con más obras
          </h2>
          <ul className="mt-3 space-y-1.5">
            {topArtists.map((row) => (
              <li key={`${row.artist_last}-${row.artist_first}`}>
                <Link
                  href={`/inventory?artist=${encodeURIComponent(row.artist_last ?? "")}`}
                  className="group flex items-center gap-3 text-sm"
                >
                  <span className="w-44 shrink-0 truncate text-[var(--ink-1)] group-hover:text-[var(--ink-1)]">
                    {artistName(row)}
                  </span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--hover)]">
                    <span
                      className="block h-full rounded-full bg-[var(--surface-alt)]0"
                      style={{ width: `${(row.count / maxArtistCount) * 100}%` }}
                    />
                  </span>
                  <span className="w-8 shrink-0 text-right tabular-nums text-[var(--ink-3)]">
                    {row.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <ImportPanel />

          <h2 className="mt-8 border-b border-[var(--stroke-soft)] pb-1.5 text-xs uppercase tracking-wide text-[var(--ink-3)]">
            Exportar
          </h2>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <a
              href="/api/admin/export?format=json&shape=website"
              className="rounded border border-[var(--stroke)] px-3 py-1.5 transition hover:bg-[var(--hover)]"
            >
              JSON para el sitio web
            </a>
            <a
              href="/api/admin/export?format=json&shape=website&forSale=1"
              className="rounded border border-[var(--stroke)] px-3 py-1.5 transition hover:bg-[var(--hover)]"
            >
              JSON solo en venta
            </a>
            <a
              href="/api/admin/export?format=json&shape=full"
              className="rounded border border-[var(--stroke)] px-3 py-1.5 transition hover:bg-[var(--hover)]"
            >
              JSON completo
            </a>
            <a
              href="/api/admin/export?format=csv"
              className="rounded border border-[var(--stroke)] px-3 py-1.5 transition hover:bg-[var(--hover)]"
            >
              CSV completo
            </a>
          </div>
          <p className="mt-2 text-xs text-[var(--ink-3)]">
            El JSON para el sitio web incluye solo las obras en inventario, con el mismo formato que
            consume la galería pública.
          </p>

          <h2 className="mt-8 border-b border-[var(--stroke-soft)] pb-1.5 text-xs uppercase tracking-wide text-[var(--ink-3)]">
            Calidad de los datos
          </h2>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Link
              href="/inventory?withImage=0"
              className="rounded border border-[var(--stroke)] px-3 py-1.5 text-[var(--ink-2)] transition hover:bg-[var(--hover)] hover:text-[var(--ink-1)]"
            >
              {formatNumber(quality.missingImage)} sin imagen
            </Link>
            <span className="rounded border border-[var(--stroke-soft)] px-3 py-1.5 text-[var(--ink-3)]">
              {formatNumber(quality.missingValue)} sin valor actual
            </span>
            <span className="rounded border border-[var(--stroke-soft)] px-3 py-1.5 text-[var(--ink-3)]">
              {formatNumber(quality.missingLocation)} sin localización
            </span>
          </div>
          <p className="mt-3 text-xs text-[var(--ink-3)]">
            Campos menos completos:{" "}
            {quality.emptyFields
              .slice(0, 6)
              .map((f) => `${f.label} (${f.filled})`)
              .join(" · ")}
          </p>

          <h2 className="mt-8 border-b border-[var(--stroke-soft)] pb-1.5 text-xs uppercase tracking-wide text-[var(--ink-3)]">
            Editadas recientemente
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {recent.map((row) => (
              <li key={row.ref} className="flex items-baseline gap-3">
                <Link
                  href={`/inventory/${row.ref}`}
                  className="flex-1 truncate text-[var(--ink-1)] hover:text-[var(--ink-1)]"
                >
                  <span className="font-mono text-xs text-[var(--ink-3)]">{row.registro}</span>{" "}
                  {row.title ? titleCase(row.title) : "Sin título"}
                </Link>
                <span className="shrink-0 text-xs text-[var(--ink-3)]">{row.updated_at}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
