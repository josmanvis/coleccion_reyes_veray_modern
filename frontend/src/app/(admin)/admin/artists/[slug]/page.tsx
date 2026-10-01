import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { artistWorks, getArtistBySlug } from "@/lib/inventory/public";
import { getProfile } from "@/lib/inventory/artist-profile";
import { lifespan } from "@/lib/inventory/artist-fields";
import { titleCase } from "@/lib/inventory/fields";
import { MUTED } from "@/components/inventory/ui";
import ArtistDetail from "@/components/inventory/ArtistDetail";
import { getTr } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const artist = getArtistBySlug(decodeURIComponent(slug));
  const tr = await getTr();
  return { title: artist ? `${artist.name} · ${tr("Artistas")}` : tr("Artista") };
}

export default async function AdminArtistPage({ params }: Props) {
  const tr = await getTr();
  const { slug } = await params;
  const artist = getArtistBySlug(decodeURIComponent(slug));
  if (!artist) notFound();

  const profile = getProfile(artist.slug);
  const works = artistWorks(artist).map((row) => ({
    ref: String(row.ref),
    registro: String(row.registro ?? ""),
    title: row.title ? titleCase(String(row.title)) : tr("Sin título"),
    year: row.year ? String(row.year) : "",
    medium: row.medium ? String(row.medium) : "",
    thumb: row.image_thumb ? String(row.image_thumb) : null,
  }));

  const years = lifespan(profile);

  return (
    <>
      <div className="border-b border-[var(--stroke-soft)] bg-[var(--surface)]">
        <div className="px-6 py-3">
          <Link
            href="/admin/artists"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--ink-3)] transition hover:text-[var(--ink-1)]"
          >
            <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
            
            {tr("Artistas")}
          </Link>
          <h1 className="mt-1 text-xl font-semibold leading-tight text-[var(--ink-1)]">
            {artist.name}
            {years && <span className={`ml-2 text-base font-normal ${MUTED}`}>{years}</span>}
          </h1>
          <p className={`mt-0.5 text-sm ${MUTED}`}>
            {tr(works.length === 1 ? "{n} obra en la colección" : "{n} obras en la colección", { n: works.length })}
          </p>
        </div>
      </div>

      <div className="px-6 py-4">
        <ArtistDetail
          slug={artist.slug}
          name={artist.name}
          works={works}
          profile={profile}
        />
      </div>
    </>
  );
}
