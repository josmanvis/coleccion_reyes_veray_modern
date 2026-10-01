import Link from "next/link";
import { facets, listArtworks } from "@/lib/inventory/db";
import { parseListParams, FILTER_KEYS } from "@/lib/inventory/params";
import { formatMoney, formatNumber } from "@/lib/inventory/fields";
import InventoryFilters from "@/components/inventory/InventoryFilters";
import InventoryTable from "@/components/inventory/InventoryTable";
import InventoryGrid from "@/components/inventory/InventoryGrid";
import Pagination from "@/components/inventory/Pagination";
import { hrefWith, toURLSearchParams, type SearchParams } from "@/components/inventory/query";
import { BTN, BTN_PRIMARY, BTN_SUBTLE, CARD, MUTED } from "@/components/inventory/ui";
import { Download, LayoutGrid, Plus, Table2 } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = { title: "Inventario · Colección Reyes-Veray" };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const search = toURLSearchParams(params);
  const view = params.view === "grid" ? "grid" : "table";

  const listParams = parseListParams(search);
  const { rows, total, page, pages } = listArtworks({
    ...listParams,
    limit: listParams.limit ?? (view === "grid" ? 60 : 50),
  });

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
            <h1 className="text-xl font-semibold leading-tight text-[var(--ink-1)]">Inventario</h1>
            <p className={`mt-0.5 text-sm ${MUTED}`}>
              {formatNumber(total)} obras
              {activeCount > 0 && " filtradas"} · {formatMoney(pageValue)} en esta página
            </p>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Vista"
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
                Tabla
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
                Galería
              </Link>
            </div>

            <a href={`/api/admin/export?format=csv&${exportSearch.toString()}`} className={BTN_SUBTLE}>
              <Download size={15} strokeWidth={1.75} aria-hidden />
              Exportar CSV
            </a>
            <Link href="/admin/artwork/new" className={BTN}>
              <Plus size={15} strokeWidth={1.75} aria-hidden />
              Nueva obra
            </Link>
            <Link href="/admin" className={BTN_PRIMARY}>
              Panel
            </Link>
          </div>
        </div>
      </div>

      <div className="shrink-0">
        <InventoryFilters facets={facets()} params={params} activeCount={activeCount} />
      </div>

      {/* The grid is the scroll container in both axes: a wide table stays
          inside it instead of pushing the page sideways, and the sticky header
          has a scrolling ancestor to stick to. */}
      <div className="min-h-0 flex-1 px-6 pt-4">
        <div className={`${CARD} h-full overflow-auto`}>
          {view === "grid" ? (
            <div className="p-4">
              <InventoryGrid rows={rows} />
            </div>
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
