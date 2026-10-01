import Link from "next/link";
import { facets, listArtworks } from "@/lib/inventory/db";
import { parseListParams, FILTER_KEYS } from "@/lib/inventory/params";
import { FIELDS, formatMoney, formatNumber } from "@/lib/inventory/fields";
import InventoryFilters from "@/components/inventory/InventoryFilters";
import InventoryTable from "@/components/inventory/InventoryTable";
import InventoryGrid from "@/components/inventory/InventoryGrid";
import InventorySheet from "@/components/inventory/InventorySheet";
import type { SheetColumn, SheetRow } from "@/components/inventory/DataSheet";
import Pagination from "@/components/inventory/Pagination";
import { hrefWith, toURLSearchParams, type SearchParams } from "@/components/inventory/query";
import { BTN, BTN_PRIMARY, BTN_SUBTLE, CARD, MUTED } from "@/components/inventory/ui";
import { Download, LayoutGrid, Plus, Sheet, Table2 } from "lucide-react";
import { getTr } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

/** Shown in the sheet until switched off; the rest are one click away in «Columnas». */
const SHEET_DEFAULT = new Set([
  "title",
  "artist_last",
  "artist_first",
  "year",
  "medium",
  "technique",
  "support",
  "dimensions",
  "edition",
  "status",
  "location",
  "current_value",
  "purchase_price",
  "sales",
  "notes",
]);

/** Fields whose header sorts the list, mapped to the `sort` the URL takes. */
const SHEET_SORT: Record<string, string> = {
  title: "title",
  artist_last: "artist",
  year: "year",
  purchase_price: "purchase_price",
  current_value: "current_value",
};

/** Fields that get autocomplete from the values already in the collection. */
const SHEET_SUGGEST: Record<string, keyof ReturnType<typeof facets>> = {
  artist_last: "artist",
  medium: "medium",
  technique: "technique",
  support: "support",
  location: "location",
  acquisition_method: "acquisitionMethod",
  artist_birth_place: "birthPlace",
  category: "category",
};

export async function generateMetadata() {
  const tr = await getTr();
  return { title: tr("Inventario · Colección Reyes-Veray") };
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const tr = await getTr();
  const params = await searchParams;
  const search = toURLSearchParams(params);
  const view = params.view === "grid" ? "grid" : params.view === "sheet" ? "sheet" : "table";

  const listParams = parseListParams(search);
  const { rows, total, page, pages } = listArtworks({
    ...listParams,
    limit: listParams.limit ?? (view === "grid" ? 60 : view === "sheet" ? 100 : 50),
  });

  const facetValues = facets();

  const activeCount = FILTER_KEYS.filter((key) => search.get(key)).length;
  const pageValue = rows.reduce(
    (sum, row) => sum + (typeof row.current_value === "number" ? row.current_value : 0),
    0
  );

  const exportSearch = new URLSearchParams(search);
  exportSearch.delete("page");
  exportSearch.delete("view");

  return (
    <div className="flex h-[calc(100vh-var(--admin-header-h))] flex-col">
      {/* Command bar: title on the left, actions on the right, Fluent-style. */}
      <div className="shrink-0 border-b border-[var(--stroke-soft)] bg-[var(--surface)]">
        <div className="flex flex-wrap items-center gap-3 px-6 py-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-tight text-[var(--ink-1)]">{tr("Inventario")}</h1>
            <p className={`mt-0.5 text-sm ${MUTED}`}>
              {tr(activeCount > 0 ? "{n} obras filtradas" : "{n} obras", { n: formatNumber(total) })} ·{" "}
              {tr("{v} en esta página", { v: formatMoney(pageValue) })}
            </p>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label={tr("Vista")}
              className="flex overflow-hidden rounded-[var(--radius)] border border-[var(--stroke)]"
            >
              <Link
                href={hrefWith("/inventory", params, { view: undefined, page: undefined })}
                aria-current={view === "table" ? "true" : undefined}
                className={`inline-flex items-center gap-1.5 px-3 py-[7px] text-sm font-semibold transition-colors ${
                  view === "table"
                    ? "bg-[var(--brand-soft)] text-[var(--brand-hover)]"
                    : "bg-[var(--surface)] text-[var(--ink-2)] hover:bg-[var(--hover)]"
                }`}
              >
                <Table2 size={15} strokeWidth={1.75} aria-hidden />
                
                {tr("Tabla")}
              </Link>
              <Link
                href={hrefWith("/inventory", params, { view: "grid", page: undefined })}
                aria-current={view === "grid" ? "true" : undefined}
                className={`inline-flex items-center gap-1.5 border-l border-[var(--stroke)] px-3 py-[7px] text-sm font-semibold transition-colors ${
                  view === "grid"
                    ? "bg-[var(--brand-soft)] text-[var(--brand-hover)]"
                    : "bg-[var(--surface)] text-[var(--ink-2)] hover:bg-[var(--hover)]"
                }`}
              >
                <LayoutGrid size={15} strokeWidth={1.75} aria-hidden />
                
                {tr("Galería")}
              </Link>
              <Link
                href={hrefWith("/inventory", params, { view: "sheet", page: undefined })}
                aria-current={view === "sheet" ? "true" : undefined}
                title={tr("Editar como hoja de cálculo")}
                className={`inline-flex items-center gap-1.5 border-l border-[var(--stroke)] px-3 py-[7px] text-sm font-semibold transition-colors ${
                  view === "sheet"
                    ? "bg-[var(--brand-soft)] text-[var(--brand-hover)]"
                    : "bg-[var(--surface)] text-[var(--ink-2)] hover:bg-[var(--hover)]"
                }`}
              >
                <Sheet size={15} strokeWidth={1.75} aria-hidden />
                {tr("Hoja")}
              </Link>
            </div>

            <a href={`/api/admin/export?format=csv&${exportSearch.toString()}`} className={BTN_SUBTLE}>
              <Download size={15} strokeWidth={1.75} aria-hidden />
              
              {tr("Exportar CSV")}
            </a>
            <Link href="/admin/artwork/new" className={BTN}>
              <Plus size={15} strokeWidth={1.75} aria-hidden />
              
              {tr("Nueva obra")}
            </Link>
            <Link href="/admin" className={BTN_PRIMARY}>
              
              {tr("Panel")}
            </Link>
          </div>
        </div>
      </div>

      <div className="shrink-0">
        <InventoryFilters facets={facetValues} params={params} activeCount={activeCount} />
      </div>

      {/* The grid is the scroll container in both axes: a wide table stays
          inside it instead of pushing the page sideways, and the sticky header
          has a scrolling ancestor to stick to. */}
      <div className="min-h-0 flex-1 px-6 pt-4">
        <div
          className={`${CARD} h-full ${view === "sheet" ? "overflow-hidden" : "overflow-auto"}`}
          data-ctx={view === "sheet" ? undefined : "inventory"}
          data-view={view}
          data-filtered={activeCount > 0 ? "1" : "0"}
          data-export-href={`/api/admin/export?format=csv&${exportSearch.toString()}`}
        >
          {view === "grid" ? (
            <div className="p-4">
              <InventoryGrid rows={rows} />
            </div>
          ) : view === "sheet" ? (
            <InventorySheet
              // A new page or filter starts a fresh sheet, so staged edits never ride along unseen.
              key={search.toString()}
              columns={FIELDS.filter((field) => field.key !== "registro").map(
                (field): SheetColumn => ({
                  key: field.key,
                  label: tr(field.label),
                  type: field.type,
                  hidden: !SHEET_DEFAULT.has(field.key),
                  suggestions: SHEET_SUGGEST[field.key]
                    ? facetValues[SHEET_SUGGEST[field.key]].slice(0, 400).map((f) => f.value)
                    : undefined,
                  sort: SHEET_SORT[field.key]
                    ? {
                        href: hrefWith("/inventory", params, {
                          sort: SHEET_SORT[field.key],
                          dir: params.sort === SHEET_SORT[field.key] && params.dir !== "desc" ? "desc" : "asc",
                          page: undefined,
                        }),
                        active: params.sort === SHEET_SORT[field.key],
                        dir: params.dir === "desc" ? "desc" : "asc",
                      }
                    : undefined,
                })
              )}
              rows={rows.map(
                (row): SheetRow => ({
                  id: String(row.ref),
                  header: String(row.registro),
                  href: `/inventory/${encodeURIComponent(String(row.ref))}`,
                  values: Object.fromEntries(
                    FIELDS.map((field) => [field.key, row[field.key] === null || row[field.key] === undefined ? "" : String(row[field.key])])
                  ),
                })
              )}
            />
          ) : (
            <InventoryTable rows={rows} params={params} />
          )}
        </div>
      </div>

      <div className="shrink-0 px-6">
        <Pagination page={page} pages={pages} total={total} params={params} />
      </div>
    </div>
  );
}
