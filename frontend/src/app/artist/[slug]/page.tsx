import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getArtist, getArtists, getArtworkIndex } from "@/lib/mac";
import { getImageUrl } from "@/lib/getImageUrl";

export const revalidate = 86400;

export async function generateStaticParams() {
  const artists = await getArtists();
  return artists.slice(0, 8).map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtist(slug);
  if (!artist) return { title: "Not found" };
  return {
    title: `${artist.name} | Colección Reyes-Veray`,
    description: artist.bio?.slice(0, 160) || `${artist.name} in the Colección Reyes-Veray.`,
  };
}

/** "Abreu, Wilson" -> "wilson abreu" so titles can be prefix-matched. */
function matchKey(name: string): string {
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const parts = clean(name).split(" ").filter(Boolean);
  if (parts.length < 2) return clean(name);
  const last = parts.pop();
  return `${last} ${parts.join(" ")}`;
}

/** Normalise a product title to its comparable "surname firstname" prefix. */
function titleKey(title: string): string {
  return title
    .split("\u2013")[0]
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const artist = await getArtist(slug);
  if (!artist) notFound();

  const all = await getArtworkIndex();
  const key = matchKey(artist.name);
  const works = all.filter((w) => titleKey(w.title).startsWith(key));

  return (
    <main className="min-h-screen pt-48 pb-32 px-6 md:px-12 lg:px-24">
      <header className="mb-20 max-w-3xl">
        <Link
          href="/artists"
          className="font-display text-[10px] uppercase tracking-widest text-neutral-400 hover:text-black transition-colors"
        >
          ← Índice
        </Link>
        <h1 className="font-serif text-5xl md:text-7xl font-light tracking-tight leading-tight mt-8">
          {artist.name}
        </h1>
        {artist.lifespan && (
          <p className="font-display text-[10px] uppercase tracking-[0.2em] text-neutral-400 mt-6">
            {artist.lifespan}
          </p>
        )}
        {artist.bio && (
          <div className="font-serif text-xl md:text-2xl font-light leading-relaxed text-neutral-600 mt-12 whitespace-pre-line">
            {artist.bio}
          </div>
        )}
      </header>

      <section>
        <h2 className="font-display text-[10px] uppercase tracking-[0.2em] text-neutral-400 border-b border-black/10 pb-4 mb-12">
          {works.length} {works.length === 1 ? "obra" : "obras"} en la colección
        </h2>

        {works.length === 0 ? (
          <p className="font-serif text-xl text-neutral-500">
            No works from this artist are catalogued yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 md:gap-12">
            {works.map((w) => (
              <Link key={w.slug} href={`/art/${w.slug}`} className="group block">
                <div className="relative aspect-[3/4] bg-neutral-100 overflow-hidden">
                  {w.image && (
                    <Image
                      src={getImageUrl(w.image, true)}
                      alt={w.title}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-contain p-4 mix-blend-multiply group-hover:opacity-70 transition-opacity"
                    />
                  )}
                </div>
                <p className="font-serif text-sm md:text-base font-light mt-3 leading-snug">
                  {w.title.split("–")[0].trim()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
