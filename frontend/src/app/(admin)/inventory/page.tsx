import Link from "next/link";
import { facets, listArtworks } from "@/lib/inventory/db";
import { parseListParams, FILTER_KEYS } from "@/lib/inventory/params";
import { formatMoney, formatNumber } from "@/lib/inventory/fields";
import InventoryFilters from "@/components/inventory/InventoryFilters";
import InventoryTable from "@/components/inventory/InventoryTable";
import InventoryGrid from "@/components/inventory/InventoryGrid";
import Pagination from "@/components/inventory/Pagination";
import { hrefWith, toURLSearchParams, type SearchParams } from "@/components/inventory/query";

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
    <main>
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-end justify-between gap-4 px-5 pb-4 pt-6">
        <div>
          <h1 className="font-serif text-3xl leading-none">Inventario</h1>
          <p className="mt-1.5 text-sm text-neutral-600">
            {formatNumber(total)} obras
            {activeCount > 0 && " filtradas"} · {formatMoney(pageValue)} en esta página
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <div className="flex overflow-hidden rounded border border-neutral-300">
            <Link
              href={hrefWith("/inventory", params, { view: undefined, page: undefined })}
              className={`px-3 py-1.5 transition ${
                view === "table" ? "bg-black text-white" : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              Tabla
            </Link>
            <Link
              href={hrefWith("/inventory", params, { view: "grid", page: undefined })}
              className={`px-3 py-1.5 transition ${
                view === "grid" ? "bg-black text-white" : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              Galería
            </Link>
          </div>
          <a
            href={`/api/admin/export?format=csv&${exportSearch.toString()}`}
            className="rounded border border-neutral-300 px-3 py-1.5 text-neutral-700 transition hover:border-neutral-600 hover:text-black"
          >
            Exportar CSV
          </a>
          <Link
            href="/admin/artwork/new"
            className="rounded border border-neutral-300 px-3 py-1.5 text-neutral-800 transition hover:border-neutral-600 hover:text-black"
          >
            + Nueva obra
          </Link>
          <Link
            href="/admin"
            className="rounded bg-black px-3 py-1.5 text-white transition hover:bg-neutral-700"
          >
            Administración
          </Link>
        </div>
      </div>

      <InventoryFilters facets={facets()} params={params} activeCount={activeCount} />

      {view === "grid" ? (
        <InventoryGrid rows={rows} />
      ) : (
        <div className="mx-auto max-w-[1600px] px-2">
          <InventoryTable rows={rows} params={params} />
        </div>
      )}

      <Pagination page={page} pages={pages} total={total} params={params} />
    </main>
  );
}
