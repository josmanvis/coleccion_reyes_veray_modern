import Link from "next/link";
import { Search, X } from "lucide-react";
import {
  LIFE_LABELS,
  artistDirectory,
  directoryFacets,
  filterDirectory,
  type DirectoryArtist,
  type LifeStatus,
} from "@/lib/inventory/artist-directory";
import { GENDERS } from "@/lib/inventory/artist-fields";
import { formatMoney, formatNumber } from "@/lib/inventory/fields";
import { hrefWith, type SearchParams } from "./query";
import { BADGE, BTN, BTN_PRIMARY, CARD, FIELD, LABEL, MUTED, type Tone } from "./ui";
import { getTr } from "@/lib/i18n-server";

const FILTER_KEYS = ["q", "gender", "country", "state", "city", "life", "bornMin", "bornMax", "missing", "forSale"] as const;

const LIFE_TONES: Record<LifeStatus, Tone> = {
  fallecido: "neutral",
  sin_defuncion: "success",
  sin_datos: "warning",
};

const COLUMNS: Array<{ key: string; label: string; sort?: string; align?: string }> = [
  { key: "name", label: "Artista", sort: "name" },
  { key: "gender", label: "Género", sort: "gender" },
  { key: "birth", label: "Nacimiento", sort: "birth" },
  { key: "death", label: "Defunción", sort: "death" },
  { key: "city", label: "Ciudad", sort: "city" },
  { key: "state", label: "Estado / región", sort: "state" },
  { key: "country", label: "País", sort: "country" },
  { key: "life", label: "Estado" },
  { key: "works", label: "Obras", sort: "works", align: "text-right" },
  { key: "sale", label: "En venta", align: "text-right" },
  { key: "value", label: "Valor", sort: "value", align: "text-right" },
];

const CELL = "border-b border-[var(--stroke-soft)] px-3 py-2 transition-colors group-hover:bg-[var(--hover)]";

function str(params: SearchParams, key: string): string | undefined {
  const v = params[key];
  return typeof v === "string" && v ? v : undefined;
}

function num(params: SearchParams, key: string): number | undefined {
  const v = Number(str(params, key));
  return str(params, key) && Number.isFinite(v) ? v : undefined;
}

/** Every artist, sortable by any column and filtered by birth, place, gender and life dates. */
export default async function ArtistDirectoryView({ params }: { params: SearchParams }) {
  const tr = await getTr();
  const all = artistDirectory();
  const facets = directoryFacets(all, { country: str(params, "country"), state: str(params, "state") });
  const sort = str(params, "sort") ?? "name";
  const dir = params.dir === "desc" ? "desc" : "asc";

  const artists = filterDirectory(all, {
    q: str(params, "q"),
    gender: str(params, "gender"),
    country: str(params, "country"),
    state: str(params, "state"),
    city: str(params, "city"),
    life: str(params, "life"),
    bornMin: num(params, "bornMin"),
    bornMax: num(params, "bornMax"),
    missing: str(params, "missing"),
    forSale: params.forSale === "1",
    sort,
    dir,
  });

  const active = FILTER_KEYS.filter((key) => str(params, key)).length;
  const genderLabel = (value: string) => tr(GENDERS.find((g) => g.value === value)?.label ?? value);
  const totalWorks = artists.reduce((n, a) => n + a.works, 0);
  const totalValue = artists.reduce((n, a) => n + a.value, 0);

  const select = (
    name: string,
    label: string,
    options: Array<{ value: string; count?: number; label?: string }>,
    width: string,
    extra?: React.ReactNode
  ) => (
    <label className={`flex min-w-0 flex-col gap-1 ${width}`}>
      <span className={LABEL}>{label}</span>
      <select name={name} defaultValue={str(params, name) ?? ""} className={`${FIELD} truncate`}>
        <option value="">{tr("Todos")}</option>
        {extra}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label ?? o.value}
            {o.count !== undefined ? ` (${o.count})` : ""}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex h-[calc(100vh-var(--admin-header-h)-45px)] flex-col">
      <div className="shrink-0 border-b border-[var(--stroke-soft)] bg-[var(--surface)] px-6 py-3">
        <h1 className="text-xl font-semibold leading-tight text-[var(--ink-1)]">{tr("Artistas")}</h1>
        <p className={`mt-0.5 text-sm ${MUTED}`}>
          {tr(active > 0 ? "{n} de {total} artistas" : "{total} artistas", {
            n: formatNumber(artists.length),
            total: formatNumber(all.length),
          })}{" "}
          · {tr("{n} obras", { n: formatNumber(totalWorks) })} · {formatMoney(totalValue)}
        </p>
      </div>

      <form method="get" action="/admin/artists" className="shrink-0 border-b border-[var(--stroke-soft)] bg-[var(--surface-alt)] px-6 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1">
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
                defaultValue={str(params, "q") ?? ""}
                placeholder={tr("Nombre, lugar o nacionalidad…")}
                className={`${FIELD} pl-8`}
              />
            </span>
          </label>
          {select(
            "gender",
            tr("Género"),
            facets.gender.map((o) => ({ ...o, label: genderLabel(o.value) })),
            "w-[150px]",
            <option value="_none">{tr("Sin especificar")}</option>
          )}
          {select(
            "life",
            tr("Vivo / fallecido"),
            facets.life.map((o) => ({ ...o, label: tr(LIFE_LABELS[o.value as LifeStatus]) })),
            "w-[190px]"
          )}
          {select("country", tr("País"), facets.country, "w-[170px]")}
          {select("state", tr("Estado / región"), facets.state, "w-[170px]")}
          {select("city", tr("Ciudad"), facets.city, "w-[180px]")}
          <label className="flex w-[90px] flex-col gap-1">
            <span className={LABEL}>{tr("Nacido ≥")}</span>
            <input type="number" name="bornMin" defaultValue={str(params, "bornMin") ?? ""} className={FIELD} />
          </label>
          <label className="flex w-[90px] flex-col gap-1">
            <span className={LABEL}>{tr("Nacido ≤")}</span>
            <input type="number" name="bornMax" defaultValue={str(params, "bornMax") ?? ""} className={FIELD} />
          </label>
          {select(
            "missing",
            tr("Datos que faltan"),
            [
              { value: "birth", label: tr("Sin año de nacimiento") },
              { value: "place", label: tr("Sin lugar de nacimiento") },
              { value: "city", label: tr("Sin ciudad (solo país o región)") },
              { value: "gender", label: tr("Sin género") },
            ],
            "w-[190px]"
          )}
          <label className="flex items-center gap-2 pb-1.5 text-sm text-[var(--ink-2)]">
            <input
              type="checkbox"
              name="forSale"
              value="1"
              defaultChecked={params.forSale === "1"}
              className="size-4 accent-[var(--brand)]"
            />
            {tr("Con obras en venta")}
          </label>

          {["sort", "dir"].map((key) =>
            str(params, key) ? <input key={key} type="hidden" name={key} value={str(params, key)} /> : null
          )}

          <div className="flex items-center gap-2 pb-0.5">
            <button type="submit" className={BTN_PRIMARY}>
              <Search size={15} strokeWidth={1.75} aria-hidden />
              {tr("Filtrar")}
            </button>
            {active > 0 && (
              <Link href="/admin/artists" className={BTN}>
                <X size={15} strokeWidth={1.75} aria-hidden />
                {tr("Limpiar ({n})", { n: active })}
              </Link>
            )}
          </div>
        </div>
      </form>

      <div className="min-h-0 flex-1 px-6 py-4">
        <div className={`${CARD} h-full overflow-auto`}>
          <table className="w-full min-w-[1000px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left">
                {COLUMNS.map((column) => {
                  const isActive = sort === column.sort;
                  const nextDir = isActive && dir === "asc" ? "desc" : column.sort === "works" || column.sort === "value" ? (isActive ? "asc" : "desc") : "asc";
                  return (
                    <th
                      key={column.key}
                      className={`sticky top-0 z-10 border-b border-[var(--stroke)] bg-[var(--surface-alt)] px-3 py-2 text-xs font-semibold text-[var(--ink-2)] ${column.align ?? ""}`}
                    >
                      {column.sort ? (
                        <Link
                          href={hrefWith("/admin/artists", params, { sort: column.sort, dir: nextDir })}
                          className="inline-flex items-center gap-1 hover:text-[var(--brand-hover)]"
                        >
                          {tr(column.label)}
                          <span className={isActive ? "text-[var(--brand)]" : "text-[var(--ink-4)]"}>
                            {isActive && dir === "desc" ? "↓" : "↑"}
                          </span>
                        </Link>
                      ) : (
                        tr(column.label)
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {artists.map((a: DirectoryArtist) => (
                <tr key={a.slug} className="group">
                  <td className={`${CELL} max-w-[260px]`}>
                    <Link href={`/admin/artists/${encodeURIComponent(a.slug)}`} className="line-clamp-1 font-medium text-[var(--ink-1)] hover:underline">
                      {a.name}
                    </Link>
                  </td>
                  <td className={`${CELL} text-[var(--ink-2)]`}>{a.gender ? genderLabel(a.gender) : <Blank />}</td>
                  <td className={`${CELL} tabular-nums text-[var(--ink-2)]`}>{a.birthYear ?? <Blank />}</td>
                  <td className={`${CELL} tabular-nums text-[var(--ink-2)]`}>{a.deathYear ?? <Blank />}</td>
                  <PlaceCell
                    value={a.birthCity}
                    title={a.birthPlace}
                    href={hrefWith("/admin/artists", params, {
                      city: a.birthCity,
                      state: a.birthState || undefined,
                      country: a.birthCountry || undefined,
                    })}
                  />
                  <PlaceCell
                    value={a.birthState}
                    title={a.birthPlace}
                    href={hrefWith("/admin/artists", params, {
                      state: a.birthState,
                      country: a.birthCountry || undefined,
                      city: undefined,
                    })}
                  />
                  <PlaceCell
                    value={a.birthCountry}
                    title={a.birthPlace}
                    href={hrefWith("/admin/artists", params, { country: a.birthCountry, state: undefined, city: undefined })}
                  />
                  <td className={CELL}>
                    <span className={BADGE[LIFE_TONES[a.life]]}>{tr(LIFE_LABELS[a.life])}</span>
                  </td>
                  <td className={`${CELL} text-right tabular-nums`}>
                    <Link
                      href={`/inventory?artist=${encodeURIComponent(a.artist_last)}`}
                      className="hover:underline"
                      title={tr("Ver sus obras en el inventario")}
                    >
                      {formatNumber(a.works)}
                    </Link>
                  </td>
                  <td className={`${CELL} text-right tabular-nums text-[var(--ink-2)]`}>{a.forSale || <Blank />}</td>
                  <td className={`${CELL} whitespace-nowrap text-right tabular-nums`}>{a.value ? formatMoney(a.value) : <Blank />}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {artists.length === 0 && (
            <p className="px-5 py-16 text-center text-sm text-[var(--ink-3)]">{tr("Ningún artista coincide con estos filtros.")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** A place part that filters the list to it when clicked; the full birthplace as typed shows on hover. */
function PlaceCell({ value, title, href }: { value: string; title: string; href: string }) {
  return (
    <td className={`${CELL} max-w-[180px] text-[var(--ink-2)]`} title={title || undefined}>
      {value ? (
        <Link href={href} className="line-clamp-1 hover:underline">
          {value}
        </Link>
      ) : (
        <Blank />
      )}
    </td>
  );
}

function Blank() {
  return <span className="text-[var(--ink-4)]">—</span>;
}
