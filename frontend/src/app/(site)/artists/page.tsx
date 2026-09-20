import Link from "next/link";
import { listArtists } from "@/lib/inventory/public";
import { normalizeText } from "@/lib/inventory/fields";

export const revalidate = 3600;

export const metadata = {
  title: "Artists | Colección Reyes-Veray",
  description: "Every artist represented in the Colección Reyes-Veray archive.",
};

/** Groups the index under A–Z headings, the way the original site listed it. */
function initialOf(surname: string): string {
  const letter = normalizeText(surname).charAt(0).toUpperCase();
  return /[A-Z]/.test(letter) ? letter : "#";
}

export default async function ArtistsIndex() {
  const artists = listArtists();

  const groups = new Map<string, typeof artists>();
  for (const artist of artists) {
    const initial = initialOf(artist.artist_last);
    if (!groups.has(initial)) groups.set(initial, []);
    groups.get(initial)!.push(artist);
  }
  const letters = [...groups.keys()].sort();

  return (
    <main className="min-h-screen bg-neutral-100 px-6 pb-24 pt-32 md:px-12">
      <header className="mx-auto max-w-[1200px] border-b border-black/10 pb-8">
        <h1 className="font-serif text-4xl leading-none md:text-6xl">Artists</h1>
        <p className="mt-3 font-display text-[10px] uppercase tracking-widest opacity-40">
          {artists.length} artists · {artists.reduce((sum, a) => sum + a.workCount, 0)} works
        </p>

        <div className="mt-6 flex flex-wrap gap-x-3 gap-y-1">
          {letters.map((letter) => (
            <a
              key={letter}
              href={`#${letter}`}
              className="font-display text-[11px] uppercase tracking-widest opacity-50 transition-opacity hover:opacity-100"
            >
              {letter}
            </a>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-[1200px]">
        {letters.map((letter) => (
          <section key={letter} id={letter} className="scroll-mt-28 border-b border-black/5 py-8">
            <h2 className="font-serif text-2xl opacity-30">{letter}</h2>
            <ul className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {groups.get(letter)!.map((artist) => (
                <li key={artist.slug}>
                  <Link
                    href={`/${artist.slug}`}
                    className="group flex items-baseline justify-between gap-3 py-1"
                  >
                    <span className="min-w-0 truncate transition-opacity group-hover:opacity-50">
                      {artist.name}
                    </span>
                    <span className="shrink-0 font-display text-[10px] tabular-nums opacity-30">
                      {artist.workCount}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
