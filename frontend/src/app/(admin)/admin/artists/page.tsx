import Link from "next/link";
import ArtistMergeCard from "@/components/inventory/ArtistMergeCard";
import { SUGGESTION_LABELS, artistReview } from "@/lib/inventory/artists";
import { formatNumber, titleCase } from "@/lib/inventory/fields";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nombres de artistas · Inventario" };

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

export default async function ArtistsPage() {
  const { duplicates, surnames, suggestions, distinctKeys, rawPairs } = artistReview();
  const pendingGroups = duplicates.length + surnames.length;

  return (
    <main className="mx-auto max-w-[1400px] px-5 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <h1 className="text-3xl leading-none">Nombres de artistas</h1>
          <p className="mt-1.5 max-w-[70ch] text-sm text-[var(--ink-3)]">
            La hoja de cálculo acumula grafías distintas del mismo nombre, así que un artista se
            cuenta varias veces y el filtro del inventario se parte. Nada se unifica solo: elige tú
            la grafía correcta en cada caso.
          </p>
        </div>
        <Link
          href="/admin"
          className="rounded border border-[var(--stroke)] px-3 py-1.5 text-sm text-[var(--ink-2)] transition hover:bg-[var(--hover)] hover:text-[var(--ink-1)]"
        >
          Volver a administración
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded border border-[var(--stroke-soft)] bg-[var(--surface)] px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-[var(--ink-3)]">Grafías registradas</p>
          <p className="mt-1 text-lg font-semibold leading-none">{formatNumber(rawPairs)}</p>
          <p className="mt-1 text-xs text-[var(--ink-3)]">Combinaciones de apellido y nombre</p>
        </div>
        <div className="rounded border border-[var(--stroke-soft)] bg-[var(--surface)] px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-[var(--ink-3)]">Artistas reales</p>
          <p className="mt-1 text-lg font-semibold leading-none">{formatNumber(distinctKeys)}</p>
          <p className="mt-1 text-xs text-[var(--ink-3)]">
            Sin contar acentos ni mayúsculas · {formatNumber(rawPairs - distinctKeys)} de más
          </p>
        </div>
        <div className="rounded border border-[var(--stroke-soft)] bg-[var(--surface)] px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-[var(--ink-3)]">Por revisar</p>
          <p className="mt-1 text-lg font-semibold leading-none">{formatNumber(pendingGroups)}</p>
          <p className="mt-1 text-xs text-[var(--ink-3)]">
            {formatNumber(suggestions.length)} sugerencia
            {suggestions.length === 1 ? "" : "s"} adicional
            {suggestions.length === 1 ? "" : "es"}
          </p>
        </div>
      </div>

      <div className="mt-10">
        <Section
          title="Mismo artista, varias grafías"
          count={duplicates.length}
          intro="El apellido y el nombre coinciden al ignorar acentos y mayúsculas, así que son con certeza la misma persona. Al unificar se reescriben ambas columnas en las obras afectadas."
          empty="No queda ningún artista duplicado."
        >
          {duplicates.map((group) => (
            <ArtistMergeCard
              key={group.key}
              scope="full"
              title={titleCase(`${group.lastKey}, ${group.firstKey}`)}
              hint="Se aplicará a apellido y nombre."
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
          title="Apellidos escritos de varias formas"
          count={surnames.length}
          intro="El mismo apellido aparece con y sin acento, o con distinta capitalización, a veces entre artistas diferentes. El filtro de /inventario agrupa por apellido exacto, así que cada grafía sale como una entrada aparte. Al unificar solo se toca el apellido; los nombres de pila se quedan como están."
          empty="Todos los apellidos se escriben de una sola forma."
        >
          {surnames.map((group) => (
            <ArtistMergeCard
              key={group.key}
              scope="surname"
              title={titleCase(group.key)}
              hint="Solo se aplicará al apellido."
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
          title="Sugerencias por revisar"
          count={suggestions.length}
          intro="Parecidos que no son coincidencias: el apellido no es idéntico, así que pueden ser dos personas distintas. Compruébalo antes de unificar."
          empty="No hay parecidos que revisar."
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
