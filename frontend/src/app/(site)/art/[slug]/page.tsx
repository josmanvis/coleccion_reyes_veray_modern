import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import ShareButton from "@/components/ShareButton";
import AcquireButton from "@/components/AcquireButton";
import PrevNext from "@/components/PrevNext";
import ViewingRoom from "./ViewingRoom";
import {
  artistHrefFor,
  artistSlugIndex,
  artworkNeighbours,
  getArtistBySlug,
  getArtworkBySlug,
} from "@/lib/inventory/public";
import { artistName, isForSale, sentenceCase } from "@/lib/inventory/fields";
import { t, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import type { ArtworkRow } from "@/lib/inventory/db";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

/**
 * Everything shown here comes from the inventory record: registro, title,
 * artist, year, medium, technique and dimensions. The scraped page description
 * is deliberately unused — it is one unparsed blob whose first line is a file
 * name, which is what used to be printed as the headline.
 *
 * Nothing about price, storage or acquisition is read, let alone rendered.
 */
function details(row: ArtworkRow, locale: Locale) {
  return [
    { label: t(locale, "art.year"), value: row.year },
    { label: t(locale, "art.medium"), value: row.medium ? sentenceCase(String(row.medium)) : null },
    {
      label: t(locale, "art.technique"),
      value: row.technique ? sentenceCase(String(row.technique)) : null,
    },
    { label: t(locale, "art.dimensions"), value: row.dimensions },
    { label: t(locale, "art.registro"), value: row.registro ? `CRV #${row.registro}` : null },
  ].filter((entry) => entry.value !== null && entry.value !== undefined && entry.value !== "");
}

function titleOf(row: ArtworkRow, locale: Locale): string {
  return row.title ? sentenceCase(String(row.title)) : t(locale, "works.untitled");
}

function imageOf(row: ArtworkRow): string | null {
  return row.image_full ? String(row.image_full) : row.image_thumb ? String(row.image_thumb) : null;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const row = getArtworkBySlug(slug);
  if (!row) return {};

  const locale = await getLocale();
  const title = titleOf(row, locale);
  const artist = artistName(row);
  const description = [artist, row.technique, row.dimensions, row.year]
    .filter(Boolean)
    .join(" · ");
  const image = imageOf(row);

  return {
    title: `${title} — ${artist} | Colección Reyes-Veray`,
    description,
    openGraph: {
      title: `${title} — ${artist}`,
      description,
      images: image ? [{ url: image, alt: title }] : [],
      siteName: "Colección Reyes-Veray",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — ${artist}`,
      description,
      images: image ? [image] : [],
    },
  };
}

export default async function ArtworkDetail({ params }: Props) {
  const { slug } = await params;
  const row = getArtworkBySlug(slug);
  // Some /art/ URLs are an artist's page, not a work — the old template showed
  // a biography under "Acquire artwork". Send those to the artist instead.
  if (!row) {
    if (getArtistBySlug(slug)) redirect(`/${slug}`);
    notFound();
  }

  const locale = await getLocale();
  const title = titleOf(row, locale);
  const artist = artistName(row);
  const image = imageOf(row);
  const forSale = isForSale(row.sales);

  const around = artworkNeighbours(row);
  const sequence = around.withinPortfolio ?? around.withinArtist;
  const artistHref = artistHrefFor(row, artistSlugIndex());
  const pageLink = (sibling: ArtworkRow | null) =>
    sibling?.website_slug
      ? {
          href: `/art/${sibling.website_slug}`,
          label: titleOf(sibling, locale),
        }
      : null;

  return (
    <main className="min-h-screen bg-neutral-100 px-6 pb-32 pt-28 md:px-12">
      <div className="mx-auto max-w-[1500px]">
        <Link
          href="/gallery"
          className="font-display text-[10px] uppercase tracking-widest opacity-50 transition-opacity hover:opacity-100"
        >
          {t(locale, "art.back")}
        </Link>

        <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16">
          {/* The work, uncropped and unobstructed. */}
          <figure className="flex flex-col gap-3">
            <div className="relative flex min-h-[50vh] items-center justify-center bg-white p-6 md:min-h-[70vh] md:p-12">
              {image ? (
                <Image
                  src={image}
                  alt={title}
                  fill
                  priority
                  quality={100}
                  sizes="(max-width: 1024px) 100vw, 70vw"
                  className="object-contain p-6 md:p-12"
                  unoptimized
                />
              ) : (
                <span className="font-display text-[10px] uppercase tracking-widest opacity-25">
                  {t(locale, "works.noImage")}
                </span>
              )}
            </div>
            {image && (
              <figcaption className="flex items-center justify-between gap-4">
                <ViewingRoom
                  src={image}
                  alt={title}
                  openLabel={t(locale, "art.viewingRoom")}
                  hint={t(locale, "art.zoomHint")}
                  closeLabel={t(locale, "art.close")}
                />
                <a
                  href={image}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="font-display text-[10px] uppercase tracking-widest opacity-30 transition-opacity hover:opacity-70"
                >
                  {t(locale, "art.download")} ↓
                </a>
              </figcaption>
            )}
          </figure>

          <aside className="self-start lg:sticky lg:top-28">
            <h1 className="font-serif text-3xl leading-tight md:text-4xl">{title}</h1>
            {artistHref ? (
              <Link
                href={artistHref}
                className="mt-2 inline-block font-serif text-xl opacity-60 transition-opacity hover:opacity-100"
              >
                {artist}
              </Link>
            ) : (
              <p className="mt-2 font-serif text-xl opacity-60">{artist}</p>
            )}

            <dl className="mt-8 border-t border-black/10 pt-6">
              {details(row, locale).map((entry) => (
                <div key={entry.label} className="flex justify-between gap-6 border-b border-black/5 py-2.5">
                  <dt className="font-display text-[10px] uppercase tracking-widest opacity-40">
                    {entry.label}
                  </dt>
                  <dd className="text-right font-serif text-base">{String(entry.value)}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 flex flex-wrap gap-3">
              {forSale ? (
                <AcquireButton
                  className="flex-1"
                  artworkTitle={title}
                  artworkImage={image || ""}
                  artworkSlug={slug}
                />
              ) : (
                <Link
                  href="/contact"
                  className="flex-1 border border-black px-4 py-4 text-center font-display text-[10px] uppercase tracking-[0.2em] transition-colors hover:bg-white"
                >
                  {t(locale, "art.enquire")}
                </Link>
              )}
              <ShareButton title={title} text={`${title} — ${artist}`} />
            </div>

            {(artistHref || around.portfolio) && (
              <div className="mt-8 flex flex-col gap-2 border-t border-black/10 pt-6">
                {artistHref && (
                  <Link
                    href={artistHref}
                    className="font-display text-[10px] uppercase tracking-widest opacity-50 transition-opacity hover:opacity-100"
                  >
                    {t(locale, "art.allByArtist")}
                  </Link>
                )}
                {around.portfolio && (
                  <Link
                    href={`/${around.portfolio.slug}`}
                    className="font-display text-[10px] uppercase tracking-widest opacity-50 transition-opacity hover:opacity-100"
                  >
                    {t(locale, "portfolio.label")}: {around.portfolio.title} →
                  </Link>
                )}
              </div>
            )}

            {sequence && (sequence.previous || sequence.next) && (
              <div className="mt-8 border-t border-black/10 pt-6">
                <PrevNext
                  previous={pageLink(sequence.previous)}
                  next={pageLink(sequence.next)}
                  caption={
                    around.withinPortfolio && around.portfolio
                      ? `${sequence.index + 1} / ${sequence.total} · ${around.portfolio.title}`
                      : `${sequence.index + 1} / ${sequence.total}`
                  }
                />
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
