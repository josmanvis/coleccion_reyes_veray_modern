import Link from "next/link";
import Image from "next/image";
import { listPortfolios } from "@/lib/inventory/public";
import { formatNumber } from "@/lib/inventory/fields";
import { CARD, MUTED } from "@/components/inventory/ui";
import { Layers } from "lucide-react";
import { getTr } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const tr = await getTr();
  return { title: tr("Portafolios · Inventario") };
}

/**
 * Portfolios are derived from the registro numbering (0012.a, 0012.b …), not a
 * table of their own, so this lists what the data implies and links through to
 * the sheets, which are ordinary records and editable as such.
 */
export default async function AdminPortfolios() {
  const tr = await getTr();
  const portfolios = listPortfolios();
  const sheets = portfolios.reduce((sum, p) => sum + p.members.length, 0);

  return (
    <>
      <div className="border-b border-[var(--stroke-soft)] bg-[var(--surface)]">
        <div className="flex flex-wrap items-center gap-3 px-6 py-3">
          <div>
            <h1 className="text-xl font-semibold leading-tight text-[var(--ink-1)]">{tr("Portafolios")}</h1>
            <p className={`mt-0.5 text-sm ${MUTED}`}>
              {tr("{n} portafolios · {m} hojas", { n: formatNumber(portfolios.length), m: formatNumber(sheets) })}
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 py-4">
        <div className={`${CARD} divide-y divide-[var(--stroke-soft)]`}>
          {portfolios.map((portfolio) => {
            const cover = portfolio.members.find((m) => m.image_thumb || m.image_full);
            const image = cover?.image_thumb || cover?.image_full;
            return (
              <Link
                key={portfolio.base}
                href={`/admin/portfolios/${encodeURIComponent(portfolio.base)}`}
                data-ctx="portfolio"
                data-base={portfolio.base}
                data-title={portfolio.title}
                {...(portfolio.parent ? { "data-parent-ref": String(portfolio.parent.ref) } : {})}
                className="flex items-center gap-4 px-4 py-2.5 transition-colors hover:bg-[var(--hover)]"
              >
                <span className="relative size-10 shrink-0 overflow-hidden rounded-sm bg-[var(--surface-alt)] ring-1 ring-[var(--stroke-soft)]">
                  {image ? (
                    <Image src={String(image)} alt="" fill sizes="40px" className="object-cover" unoptimized />
                  ) : (
                    <Layers
                      size={16}
                      strokeWidth={1.75}
                      aria-hidden
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--ink-4)]"
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--ink-1)]">
                    {portfolio.title}
                  </span>
                  <span className={`block text-xs ${MUTED}`}>{tr("CRV {base}", { base: portfolio.base })}</span>
                </span>
                <span className={`shrink-0 text-sm tabular-nums ${MUTED}`}>
                  {tr("{n} hojas", { n: portfolio.members.length })}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
