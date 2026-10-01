import Link from "next/link";
import {
  STATUS_GROUPS,
  artistName,
  formatMoney,
  isForSale,
  titleCase,
  QUICK_EDIT_KEYS,
  type StatusGroup,
} from "@/lib/inventory/fields";
import SaleToggle from "./SaleToggle";
import QuickEdit from "./QuickEdit";
import ThumbPreview from "./ThumbPreview";
import type { ArtworkRow } from "@/lib/inventory/db";
import { artistHrefFor, artistSlugIndex } from "@/lib/inventory/public";
import { PUBLIC_SITE_ENABLED } from "@/lib/site-config";
import { hrefWith, type SearchParams } from "./query";
import { BADGE, type Tone } from "./ui";
import { artworkCtx } from "./context-data";
import { getTr } from "@/lib/i18n-server";

const STATUS_TONES: Record<StatusGroup, Tone> = {
  en_inventario: "success",
  de_accessed: "neutral",
  otro: "warning",
  sin_estatus: "neutral",
};

export async function StatusPill({ group }: { group: string }) {
  const tr = await getTr();
  const key = (group in STATUS_TONES ? group : "sin_estatus") as StatusGroup;
  return <span className={BADGE[STATUS_TONES[key]]}>{tr(STATUS_GROUPS[key])}</span>;
}

const CELL =
  "border-b border-[var(--stroke-soft)] px-3 py-2 text-[var(--ink-1)] transition-colors group-hover:bg-[var(--hover)]";

const COLUMNS: Array<{ key: string; label: string; sort?: string; align?: string }> = [
  { key: "image", label: "" },
  { key: "registro", label: "#", sort: "registro" },
  { key: "title", label: "Título", sort: "title" },
  { key: "artist", label: "Artista", sort: "artist" },
  { key: "year", label: "Año", sort: "year" },
  { key: "technique", label: "Técnica / soporte" },
  { key: "dimensions", label: "Dimensiones" },
  { key: "location", label: "Localización" },
  { key: "status", label: "Estatus" },
  { key: "for_sale", label: "Venta" },
  { key: "current_value", label: "Valor", sort: "current_value", align: "text-right" },
  { key: "actions", label: "" },
];

function quickValues(row: ArtworkRow): Record<string, string> {
  return Object.fromEntries(
    QUICK_EDIT_KEYS.map((key) => [key, row[key] === null || row[key] === undefined ? "" : String(row[key])])
  );
}

async function SortHeader({
  column,
  params,
}: {
  column: (typeof COLUMNS)[number];
  params: SearchParams;
}) {
  const tr = await getTr();
  if (!column.sort) return <>{tr(column.label)}</>;

  const activeSort = (params.sort as string) ?? "registro";
  const activeDir = params.dir === "desc" ? "desc" : "asc";
  const isActive = activeSort === column.sort;
  const nextDir = isActive && activeDir === "asc" ? "desc" : "asc";

  return (
    <Link
      href={hrefWith("/inventory", params, { sort: column.sort, dir: nextDir, page: undefined })}
      className="inline-flex items-center gap-1 transition-colors hover:text-[var(--brand-hover)]"
    >
      {tr(column.label)}
      <span className={isActive ? "text-[var(--brand)]" : "text-[var(--ink-4)]"}>
        {isActive && activeDir === "desc" ? "↓" : "↑"}
      </span>
    </Link>
  );
}

export default async function InventoryTable({
  rows,
  params,
}: {
  rows: ArtworkRow[];
  params: SearchParams;
}) {
  const tr = await getTr();
  // Built once per render; a per-row lookup would rebuild the whole index.
  const artistSlugs = artistSlugIndex();

  return (
    <div>
      <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-left">
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                {...(column.sort ? { "data-ctx": "sort", "data-sort": column.sort } : {})}
                className={`sticky top-0 z-20 border-b border-[var(--stroke)] bg-[var(--surface-alt)] px-3 py-2 text-xs font-semibold text-[var(--ink-2)] ${
                  column.align ?? ""
                }`}
              >
                <SortHeader column={column} params={params} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.ref} className="group" {...artworkCtx(row)}>
              <td className={CELL}>
                <Link href={`/inventory/${row.ref}`} className="block">
                  <ThumbPreview
                    src={row.image_full ? String(row.image_full) : row.image_thumb ? String(row.image_thumb) : null}
                    alt={row.title ? String(row.title) : ""}
                    caption={`${row.registro} · ${row.title ? titleCase(String(row.title)) : tr("Sin título")}`}
                  />
                </Link>
              </td>
              <td className={`${CELL} font-mono text-xs text-[var(--ink-3)]`}>
                <Link href={`/inventory/${row.ref}`}>{row.registro}</Link>
              </td>
              <td className={`${CELL} max-w-[260px]`}>
                <Link href={`/inventory/${row.ref}`} className="line-clamp-1 hover:underline">
                  {row.title ? titleCase(String(row.title)) : tr("Sin título")}
                </Link>
              </td>
              <td className={`${CELL} max-w-[180px]`}>
                {(() => {
                  // The public artist page is unavailable while the site is
                  // off, so link to the same artist's works in the inventory.
                  const href = PUBLIC_SITE_ENABLED
                    ? artistHrefFor(row, artistSlugs)
                    : row.artist_last
                      ? `/inventory?artist=${encodeURIComponent(String(row.artist_last))}`
                      : null;
                  return href ? (
                    <Link href={href} className="line-clamp-1 text-[var(--ink-1)] hover:underline">
                      {artistName(row)}
                    </Link>
                  ) : (
                    <span className="line-clamp-1 text-[var(--ink-1)]">{artistName(row)}</span>
                  );
                })()}
              </td>
              <td className={`${CELL} text-[var(--ink-2)]`}>{row.year ?? "—"}</td>
              <td className={`${CELL} max-w-[200px] text-[var(--ink-2)]`}>
                <span className="line-clamp-1">
                  {[row.technique, row.support].filter(Boolean).join(" / ") || "—"}
                </span>
              </td>
              <td className={`${CELL} whitespace-nowrap text-[var(--ink-2)]`}>{row.dimensions ?? "—"}</td>
              <td className={`${CELL} max-w-[160px] text-[var(--ink-2)]`}>
                <span className="line-clamp-1">{row.location ?? "—"}</span>
              </td>
              <td className={CELL}>
                <StatusPill group={row.status_group} />
              </td>
              <td className={CELL}>
                <SaleToggle
                  refId={String(row.ref)}
                  registro={String(row.registro)}
                  sales={row.sales === null ? null : String(row.sales)}
                  initial={isForSale(row.sales)}
                  variant="pill"
                />
              </td>
              <td className={`${CELL} whitespace-nowrap text-right tabular-nums`}>
                {formatMoney(row.current_value)}
              </td>
              <td className={`${CELL} whitespace-nowrap text-right`}>
                <QuickEdit
                  refId={String(row.ref)}
                  registro={String(row.registro)}
                  title={row.title ? titleCase(String(row.title)) : tr("Sin título")}
                  values={quickValues(row)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 && (
        <p className="px-5 py-16 text-center text-sm text-[var(--ink-3)]">
          
          {tr("Ninguna obra coincide con estos filtros.")}
        </p>
      )}
    </div>
  );
}
