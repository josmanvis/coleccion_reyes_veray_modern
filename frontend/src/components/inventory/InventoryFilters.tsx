import Link from "next/link";
import { STATUS_GROUPS, titleCase } from "@/lib/inventory/fields";
import type { Facets } from "@/lib/inventory/db";
import type { SearchParams } from "./query";
import { BTN, BTN_PRIMARY, FIELD, LABEL } from "./ui";
import { Search, X } from "lucide-react";
import { getTr } from "@/lib/i18n-server";

type Option = { value: string; count: number };

async function Select({
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
  const tr = await getTr();
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className={LABEL}>{label}</span>
      <select
        name={name}
        defaultValue={value ?? ""}
        className={`${FIELD} truncate`}
      >
        <option value="">{tr("Todos")}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {format(option.value)} ({option.count})
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function InventoryFilters({
  facets,
  params,
  activeCount,
}: {
  facets: Facets;
  params: SearchParams;
  activeCount: number;
}) {
  const tr = await getTr();
  const value = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : undefined;

  return (
    <form method="get" action="/inventory" className="border-b border-[var(--stroke-soft)] bg-[var(--surface-alt)]">
      <div className="px-6 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[240px] flex-1 flex-col gap-1">
            <span className={LABEL}>{tr("Buscar")}</span>
            <span className="relative block">
              <Search
                size={15}
                strokeWidth={1.75}
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)]"
              />
              <input
                type="search"
                name="q"
                defaultValue={value("q") ?? ""}
                placeholder={tr("Título, artista, técnica… (tolera errores)")}
                className={`${FIELD} pl-8`}
              />
            </span>
          </label>

          <div className="w-[170px]">
            <Select
              name="statusGroup"
              label={tr("Estatus")}
              value={value("statusGroup")}
              options={facets.statusGroup}
              format={(v) => tr(STATUS_GROUPS[v as keyof typeof STATUS_GROUPS] ?? v)}
            />
          </div>
          <div className="w-[190px]">
            <Select
              name="artist"
              label={tr("Artista")}
              value={value("artist")}
              options={facets.artist}
              format={titleCase}
            />
          </div>
          <div className="w-[170px]">
            <Select
              name="technique"
              label={tr("Técnica")}
              value={value("technique")}
              options={facets.technique}
            />
          </div>
          <div className="w-[150px]">
            <Select
              name="support"
              label={tr("Soporte")}
              value={value("support")}
              options={facets.support}
            />
          </div>
          <div className="w-[180px]">
            <Select
              name="location"
              label={tr("Localización")}
              value={value("location")}
              options={facets.location}
            />
          </div>

          <label className="flex w-[80px] flex-col gap-1">
            <span className={LABEL}>{tr("Año ≥")}</span>
            <input
              type="number"
              name="yearMin"
              defaultValue={value("yearMin") ?? ""}
              className={FIELD}
            />
          </label>
          <label className="flex w-[80px] flex-col gap-1">
            <span className={LABEL}>{tr("Año ≤")}</span>
            <input
              type="number"
              name="yearMax"
              defaultValue={value("yearMax") ?? ""}
              className={FIELD}
            />
          </label>

          <label className="flex items-center gap-2 pb-1.5 text-sm text-[var(--ink-2)]">
            <input
              type="checkbox"
              name="withImage"
              value="1"
              defaultChecked={value("withImage") === "1"}
              className="size-4 accent-[var(--brand)]"
            />
            
            {tr("Con imagen")}
          </label>

          <label className="flex items-center gap-2 pb-1.5 text-sm text-[var(--ink-2)]">
            <input
              type="checkbox"
              name="forSale"
              value="1"
              defaultChecked={value("forSale") === "1"}
              className="size-4 accent-[var(--brand)]"
            />
            
            {tr("En venta")}
          </label>

          {/* Keep the current view and sort when the filter form submits. */}
          {["view", "sort", "dir", "limit"].map((key) =>
            value(key) ? <input key={key} type="hidden" name={key} value={value(key)} /> : null
          )}

          <div className="flex items-center gap-2 pb-0.5">
            <button
              type="submit"
              className={BTN_PRIMARY}
            >
              <Search size={15} strokeWidth={1.75} aria-hidden />
              
              {tr("Filtrar")}
            </button>
            {activeCount > 0 && (
              <Link
                href="/inventory"
                className={BTN}
              >
                <X size={15} strokeWidth={1.75} aria-hidden />
                {tr("Limpiar ({n})", { n: activeCount })}
              </Link>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
