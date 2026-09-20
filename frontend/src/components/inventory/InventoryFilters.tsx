import Link from "next/link";
import { STATUS_GROUPS, titleCase } from "@/lib/inventory/fields";
import type { Facets } from "@/lib/inventory/db";
import type { SearchParams } from "./query";

type Option = { value: string; count: number };

function Select({
  name,
  label,
  options,
  value,
  format = (v: string) => v,
}: {
  name: string;
  label: string;
  options: Option[];
  value?: string;
  format?: (value: string) => string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-neutral-500">{label}</span>
      <select
        name={name}
        defaultValue={value ?? ""}
        className="w-full truncate rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none transition focus:border-black"
      >
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {format(option.value)} ({option.count})
          </option>
        ))}
      </select>
    </label>
  );
}

export default function InventoryFilters({
  facets,
  params,
  activeCount,
}: {
  facets: Facets;
  params: SearchParams;
  activeCount: number;
}) {
  const value = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : undefined;

  return (
    <form method="get" action="/inventory" className="border-b border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-[1600px] px-5 py-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[240px] flex-1 flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-neutral-500">Buscar</span>
            <input
              type="search"
              name="q"
              defaultValue={value("q") ?? ""}
              placeholder="Título, artista, técnica… (tolera errores de escritura)"
              className="w-full rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-black"
            />
          </label>

          <div className="w-[170px]">
            <Select
              name="statusGroup"
              label="Estatus"
              value={value("statusGroup")}
              options={facets.statusGroup}
              format={(v) => STATUS_GROUPS[v as keyof typeof STATUS_GROUPS] ?? v}
            />
          </div>
          <div className="w-[190px]">
            <Select
              name="artist"
              label="Artista"
              value={value("artist")}
              options={facets.artist}
              format={titleCase}
            />
          </div>
          <div className="w-[170px]">
            <Select
              name="technique"
              label="Técnica"
              value={value("technique")}
              options={facets.technique}
            />
          </div>
          <div className="w-[150px]">
            <Select
              name="support"
              label="Soporte"
              value={value("support")}
              options={facets.support}
            />
          </div>
          <div className="w-[180px]">
            <Select
              name="location"
              label="Localización"
              value={value("location")}
              options={facets.location}
            />
          </div>

          <label className="flex w-[80px] flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-neutral-500">Año ≥</span>
            <input
              type="number"
              name="yearMin"
              defaultValue={value("yearMin") ?? ""}
              className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none transition focus:border-black"
            />
          </label>
          <label className="flex w-[80px] flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-neutral-500">Año ≤</span>
            <input
              type="number"
              name="yearMax"
              defaultValue={value("yearMax") ?? ""}
              className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none transition focus:border-black"
            />
          </label>

          <label className="flex items-center gap-2 pb-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              name="withImage"
              value="1"
              defaultChecked={value("withImage") === "1"}
              className="size-4 accent-black"
            />
            Con imagen
          </label>

          <label className="flex items-center gap-2 pb-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              name="forSale"
              value="1"
              defaultChecked={value("forSale") === "1"}
              className="size-4 accent-black"
            />
            En venta
          </label>

          {/* Keep the current view and sort when the filter form submits. */}
          {["view", "sort", "dir", "limit"].map((key) =>
            value(key) ? <input key={key} type="hidden" name={key} value={value(key)} /> : null
          )}

          <div className="flex items-center gap-2 pb-0.5">
            <button
              type="submit"
              className="rounded bg-black px-4 py-2 text-sm text-white transition hover:bg-neutral-700"
            >
              Filtrar
            </button>
            {activeCount > 0 && (
              <Link
                href="/inventory"
                className="rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-700 transition hover:border-neutral-600 hover:text-black"
              >
                Limpiar ({activeCount})
              </Link>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
