import Link from "next/link";
import {
  STATUS_GROUPS,
  artistName,
  formatMoney,
  isForSale,
  titleCase,
  type StatusGroup,
} from "@/lib/inventory/fields";
import SaleToggle from "./SaleToggle";
import ThumbPreview from "./ThumbPreview";
import type { ArtworkRow } from "@/lib/inventory/db";
import { artistHrefFor, artistSlugIndex } from "@/lib/inventory/public";
import { hrefWith, type SearchParams } from "./query";

const STATUS_STYLES: Record<StatusGroup, string> = {
  en_inventario: "bg-emerald-50 text-emerald-800 border-emerald-200",
  de_accessed: "bg-stone-100 text-stone-600 border-stone-300",
  otro: "bg-amber-50 text-amber-800 border-amber-200",
  sin_estatus: "bg-white text-neutral-500 border-neutral-200",
};

export function StatusPill({ group }: { group: string }) {
  const key = (group in STATUS_STYLES ? group : "sin_estatus") as StatusGroup;
  return (
    <span className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 text-xs ${STATUS_STYLES[key]}`}>
      {STATUS_GROUPS[key]}
    </span>
  );
}

const CELL =
  "border-b border-neutral-200 px-3 py-1.5 transition group-hover:bg-neutral-100";

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
];

function SortHeader({
  column,
  params,
}: {
  column: (typeof COLUMNS)[number];
  params: SearchParams;
}) {
  if (!column.sort) return <>{column.label}</>;

  const activeSort = (params.sort as string) ?? "registro";
  const activeDir = params.dir === "desc" ? "desc" : "asc";
  const isActive = activeSort === column.sort;
  const nextDir = isActive && activeDir === "asc" ? "desc" : "asc";

  return (
    <Link
      href={hrefWith("/inventory", params, { sort: column.sort, dir: nextDir, page: undefined })}
      className="inline-flex items-center gap-1 transition hover:text-black"
    >
      {column.label}
      <span className={isActive ? "text-neutral-900" : "text-neutral-500"}>
        {isActive && activeDir === "desc" ? "↓" : "↑"}
      </span>
    </Link>
  );
}

export default function InventoryTable({
  rows,
  params,
}: {
  rows: ArtworkRow[];
  params: SearchParams;
}) {
  // Built once per render; a per-row lookup would rebuild the whole index.
  const artistSlugs = artistSlugIndex();

  return (
    <div>
      <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-neutral-500">
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                className={`sticky top-[var(--admin-header-h)] z-30 border-b border-neutral-300 bg-[#fdfcfc] px-3 py-2 font-normal ${
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
            <tr key={row.ref} className="group">
              <td className={CELL}>
                <Link href={`/inventory/${row.ref}`} className="block">
                  <ThumbPreview
                    src={row.image_full ? String(row.image_full) : row.image_thumb ? String(row.image_thumb) : null}
                    alt={row.title ? String(row.title) : ""}
                    caption={`${row.registro} · ${row.title ? titleCase(String(row.title)) : "Sin título"}`}
                  />
                </Link>
              </td>
              <td className={`${CELL} font-mono text-xs text-neutral-600`}>
                <Link href={`/inventory/${row.ref}`}>{row.registro}</Link>
              </td>
              <td className={`${CELL} max-w-[260px]`}>
                <Link href={`/inventory/${row.ref}`} className="line-clamp-1 hover:underline">
                  {row.title ? titleCase(String(row.title)) : "Sin título"}
                </Link>
              </td>
              <td className={`${CELL} max-w-[180px]`}>
                {(() => {
                  const href = artistHrefFor(row, artistSlugs);
                  return href ? (
                    <Link href={href} className="line-clamp-1 text-neutral-800 hover:underline">
                      {artistName(row)}
                    </Link>
                  ) : (
                    <span className="line-clamp-1 text-neutral-800">{artistName(row)}</span>
                  );
                })()}
              </td>
              <td className={`${CELL} text-neutral-700`}>{row.year ?? "—"}</td>
              <td className={`${CELL} max-w-[200px] text-neutral-700`}>
                <span className="line-clamp-1">
                  {[row.technique, row.support].filter(Boolean).join(" / ") || "—"}
                </span>
              </td>
              <td className={`${CELL} whitespace-nowrap text-neutral-700`}>{row.dimensions ?? "—"}</td>
              <td className={`${CELL} max-w-[160px] text-neutral-700`}>
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
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 && (
        <p className="px-5 py-16 text-center text-sm text-neutral-500">
          Ninguna obra coincide con estos filtros.
        </p>
      )}
    </div>
  );
}
