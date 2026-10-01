import Link from "next/link";
import ArtistMergeCard from "@/components/inventory/ArtistMergeCard";
import { SUGGESTION_LABELS, artistReview } from "@/lib/inventory/artists";
import { formatNumber, titleCase } from "@/lib/inventory/fields";
import { getTr } from "@/lib/i18n-server";
import ArtistDirectoryView from "@/components/inventory/ArtistDirectory";
import { duplicateArtistGroups, duplicateSurnameGroups } from "@/lib/inventory/artists";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const tr = await getTr();
  return { title: tr("Nombres de artistas · Inventario") };
}

function Section({
  title,
  intro,
  count,
  empty,
  children,
}: {
  title: string;
  intro: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="flex items-baseline justify-between gap-3 border-b border-[var(--stroke-soft)] pb-1.5 text-xs uppercase tracking-wide text-[var(--ink-3)]">
        <span>{title}</span>
        <span className="tabular-nums">{formatNumber(count)}</span>
      </h2>
      <p className="mt-2 max-w-[70ch] text-xs text-[var(--ink-3)]">{intro}</p>
      {count === 0 ? (
        <p className="mt-3 rounded border border-[var(--stroke-soft)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink-3)]">
          {empty}
        </p>
      ) : (
        <div className="mt-3 grid gap-3 xl:grid-cols-2">{children}</div>
      )}
    </section>
  );
}

async function NameReview() {
  const tr = await getTr();
  const { duplicates, surnames, suggestions, distinctKeys, rawPairs } = artistReview();
  const pendingGroups = duplicates.length + surnames.length;

  return (
    <main className="mx-auto max-w-[1400px] px-5 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <h2 className="text-2xl leading-none">{tr("Nombres de artistas")}</h2>
          <p className="mt-1.5 max-w-[70ch] text-sm text-[var(--ink-3)]">
            
            {tr("La hoja de cálculo acumula grafías distintas del mismo nombre, así que un artista se cuenta varias veces y el filtro del inventario se parte. Nada se unifica solo: elige tú la grafía correcta en cada caso.")}
          </p>
        </div>
        <Link
          href="/admin"
          className="rounded border border-[var(--stroke)] px-3 py-1.5 text-sm text-[var(--ink-2)] transition hover:bg-[var(--hover)] hover:text-[var(--ink-1)]"
        >
          
          {tr("Volver a administración")}
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded border border-[var(--stroke-soft)] bg-[var(--surface)] px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-[var(--ink-3)]">{tr("Grafías registradas")}</p>
          <p className="mt-1 text-lg font-semibold leading-none">{formatNumber(rawPairs)}</p>
          <p className="mt-1 text-xs text-[var(--ink-3)]">{tr("Combinaciones de apellido y nombre")}</p>
        </div>
        <div className="rounded border border-[var(--stroke-soft)] bg-[var(--surface)] px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-[var(--ink-3)]">{tr("Artistas reales")}</p>
          <p className="mt-1 text-lg font-semibold leading-none">{formatNumber(distinctKeys)}</p>
          <p className="mt-1 text-xs text-[var(--ink-3)]">
            {tr("Sin contar acentos ni mayúsculas · {n} de más", { n: formatNumber(rawPairs - distinctKeys) })}
          </p>
        </div>
        <div className="rounded border border-[var(--stroke-soft)] bg-[var(--surface)] px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-[var(--ink-3)]">{tr("Por revisar")}</p>
          <p className="mt-1 text-lg font-semibold leading-none">{formatNumber(pendingGroups)}</p>
          <p className="mt-1 text-xs text-[var(--ink-3)]">
            {tr(
              suggestions.length === 1 ? "{n} sugerencia adicional" : "{n} sugerencias adicionales",
              { n: formatNumber(suggestions.length) }
            )}
          </p>
        </div>
      </div>

      <div className="mt-10">
        <Section
          title={tr("Mismo artista, varias grafías")}
          count={duplicates.length}
          intro={tr("El apellido y el nombre coinciden al ignorar acentos y mayúsculas, así que son con certeza la misma persona. Al unificar se reescriben ambas columnas en las obras afectadas.")}
          empty={tr("No queda ningún artista duplicado.")}
        >
          {duplicates.map((group) => (
            <ArtistMergeCard
              key={group.key}
              scope="full"
              title={titleCase(`${group.lastKey}, ${group.firstKey}`)}
              hint={tr("Se aplicará a apellido y nombre.")}
              total={group.total}
              variants={group.variants.map((v) => ({
                artist_last: v.artist_last,
                artist_first: v.artist_first,
                count: v.count,
              }))}
            />
          ))}
        </Section>

        <Section
          title={tr("Apellidos escritos de varias formas")}
          count={surnames.length}
          intro={tr("El mismo apellido aparece con y sin acento, o con distinta capitalización, a veces entre artistas diferentes. El filtro de /inventario agrupa por apellido exacto, así que cada grafía sale como una entrada aparte. Al unificar solo se toca el apellido; los nombres de pila se quedan como están.")}
          empty={tr("Todos los apellidos se escriben de una sola forma.")}
        >
          {surnames.map((group) => (
            <ArtistMergeCard
              key={group.key}
              scope="surname"
              title={titleCase(group.key)}
              hint={tr("Solo se aplicará al apellido.")}
              total={group.total}
              variants={group.variants.map((v) => ({
                artist_last: v.artist_last,
                count: v.count,
                detail: v.firsts.length ? v.firsts.join(" · ") : undefined,
              }))}
            />
          ))}
        </Section>

        <Section
          title={tr("Sugerencias por revisar")}
          count={suggestions.length}
          intro={tr("Parecidos que no son coincidencias: el apellido no es idéntico, así que pueden ser dos personas distintas. Compruébalo antes de unificar.")}
          empty={tr("No hay parecidos que revisar.")}
        >
          {suggestions.map((suggestion) => (
            <ArtistMergeCard
              key={suggestion.id}
              scope="full"
              tone="suggestion"
              // When the two sides differ only in spacing they title-case to the
              // same text, so showing it twice would read as a mistake.
              title={[
                ...new Set(suggestion.sides.map((s) => titleCase(`${s.lastKey}, ${s.firstKey}`))),
              ].join("  ·  ")}
              hint={`${SUGGESTION_LABELS[suggestion.reason]}. Pueden ser artistas distintos.`}
              total={suggestion.total}
              variants={suggestion.variants.map((v) => ({
                artist_last: v.artist_last,
                artist_first: v.artist_first,
                count: v.count,
              }))}
            />
          ))}
        </Section>
      </div>
    </main>
  );
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** All artists by default; the duplicate-name review sits under its own tab. */
export default async function ArtistsPage({ searchParams }: Props) {
  const tr = await getTr();
  const params = await searchParams;
  const tab = params.tab === "nombres" ? "nombres" : "todos";
  const pending = duplicateArtistGroups().length + duplicateSurnameGroups().length;

  const tabClass = (active: boolean) =>
    `border-b-2 px-1 pb-2 text-sm font-semibold transition-colors ${
      active
        ? "border-[var(--brand)] text-[var(--ink-1)]"
        : "border-transparent text-[var(--ink-3)] hover:text-[var(--ink-1)]"
    }`;

  return (
    <>
      <nav className="flex gap-5 border-b border-[var(--stroke-soft)] bg-[var(--surface)] px-6 pt-3">
        <Link href="/admin/artists" className={tabClass(tab === "todos")} aria-current={tab === "todos" ? "page" : undefined}>
          {tr("Todos los artistas")}
        </Link>
        <Link
          href="/admin/artists?tab=nombres"
          className={tabClass(tab === "nombres")}
          aria-current={tab === "nombres" ? "page" : undefined}
        >
          {tr("Revisar nombres")}
          {pending > 0 && (
            <span className="ml-1.5 rounded-full bg-[var(--warning-soft)] px-1.5 text-xs text-[var(--warning)]">{pending}</span>
          )}
        </Link>
      </nav>
      {tab === "nombres" ? <NameReview /> : <ArtistDirectoryView params={params} />}
    </>
  );
}
