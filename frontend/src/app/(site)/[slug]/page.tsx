import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  artistNeighbours,
  artistWorks,
  getArtistBySlug,
  getArtworkBySlug,
  getPortfolio,
  listPortfolios,
  neighbours,
  type Portfolio,
  type PublicArtist,
} from "@/lib/inventory/public";
import PrevNext from "@/components/PrevNext";
import PageBlocks from "@/components/PageBlocks";
import { getPublishedPage } from "@/lib/inventory/pages";
import { getSitePage } from "@/lib/site-content";
import WorksGrid from "@/components/site/WorksGrid";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

/**
 * The original site published artists and artworks as flat top-level pages, so
 * one route resolves all of them: /alvarez-lezama-manuel, /portafolio-0012 and
 * the legacy artwork URLs, which redirect to the viewing room.
 */
function resolve(slug: string):
  | { kind: "artist"; artist: PublicArtist }
  | { kind: "portfolio"; portfolio: Portfolio }
  | { kind: "artwork"; href: string }
  | { kind: "page"; title: string }
  | null {
  // A page published from the admin takes the URL ahead of everything else.
  const page = getPublishedPage(slug);
  if (page) return { kind: "page", title: page.title };

  const artist = getArtistBySlug(slug);
  if (artist) return { kind: "artist", artist };

  const base = slug.startsWith("portafolio-") ? slug.slice("portafolio-".length) : null;
  if (base) {
    const portfolio = getPortfolio(base);
    if (portfolio) return { kind: "portfolio", portfolio };
  }

  if (getArtworkBySlug(slug)) return { kind: "artwork", href: `/art/${slug}` };

  return null;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const resolved = resolve(slug);
  if (!resolved) return {};

  if (resolved.kind === "artist") {
    const { artist } = resolved;
    return {
      title: `${artist.name} | Colección Reyes-Veray`,
      description:
        artist.bio?.replace(/\s+/g, " ").slice(0, 160) ??
        `${artist.workCount} works by ${artist.name} in the Colección Reyes-Veray.`,
    };
  }
  if (resolved.kind === "page") {
    const page = getPublishedPage(slug);
    return {
      title: page?.meta_title || `${resolved.title} | Colección Reyes-Veray`,
      description: page?.meta_description || page?.description || undefined,
    };
  }
  if (resolved.kind === "portfolio") {
    const { portfolio } = resolved;
    return {
      title: `${portfolio.title} | Colección Reyes-Veray`,
      description: `${portfolio.members.length} sheets in the portfolio ${portfolio.title}.`,
    };
  }
  return {};
}

/** The bios are stored as one block with the Spanish text first, then English. */
function Biography({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="max-w-[70ch] space-y-4 text-sm leading-relaxed opacity-70">
      {(paragraphs.length > 0 ? paragraphs : [text]).map((paragraph, i) => (
        <p key={i} className="whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

function ArtistView({ artist }: { artist: PublicArtist }) {
  const works = artistWorks(artist);
  const around = artistNeighbours(artist.slug);

  return (
    <main className="min-h-screen bg-neutral-100 px-6 pb-24 pt-32 md:px-12">
      <div className="mx-auto max-w-[1400px]">
        <Link
          href="/artists"
          className="font-display text-[10px] uppercase tracking-widest opacity-50 transition-opacity hover:opacity-100"
        >
          ← All artists
        </Link>

        <header className="mt-6 border-b border-black/10 pb-8">
          <h1 className="font-serif text-4xl leading-tight md:text-6xl">{artist.name}</h1>
          <p className="mt-3 font-display text-[10px] uppercase tracking-widest opacity-40">
            {artist.workCount} {artist.workCount === 1 ? "work" : "works"} in the collection
          </p>
          {artist.bio && (
            <div className="mt-8">
              <Biography text={artist.bio} />
            </div>
          )}
        </header>

        <div className="py-10">
          <WorksGrid rows={works} />
        </div>

        <PrevNext
          previous={
            around.previous
              ? { href: `/${around.previous.slug}`, label: around.previous.name }
              : null
          }
          next={around.next ? { href: `/${around.next.slug}`, label: around.next.name } : null}
          caption={around.index >= 0 ? `${around.index + 1} / ${around.total}` : undefined}
        />
      </div>
    </main>
  );
}

function PortfolioView({ portfolio }: { portfolio: Portfolio }) {
  const all = listPortfolios();
  const around = neighbours(all, (p) => p.base === portfolio.base);
  const blurb = portfolio.parent?.notes ?? portfolio.parent?.exhibition_history ?? null;

  return (
    <main className="min-h-screen bg-neutral-100 px-6 pb-24 pt-32 md:px-12">
      <div className="mx-auto max-w-[1400px]">
        <Link
          href="/portfolios"
          className="font-display text-[10px] uppercase tracking-widest opacity-50 transition-opacity hover:opacity-100"
        >
          ← All portfolios
        </Link>

        <header className="mt-6 border-b border-black/10 pb-8">
          <p className="font-display text-[10px] uppercase tracking-widest opacity-40">Portfolio</p>
          <h1 className="mt-2 font-serif text-4xl leading-tight md:text-6xl">{portfolio.title}</h1>
          <p className="mt-3 font-display text-[10px] uppercase tracking-widest opacity-40">
            {portfolio.members.length} sheets · CRV #{portfolio.base}
          </p>
          {blurb && (
            <p className="mt-6 max-w-[70ch] whitespace-pre-line text-sm leading-relaxed opacity-70">
              {String(blurb)}
            </p>
          )}
        </header>

        <div className="py-10">
          <WorksGrid rows={portfolio.members} />
        </div>

        <PrevNext
          previous={
            around.previous
              ? { href: `/${around.previous.slug}`, label: around.previous.title }
              : null
          }
          next={around.next ? { href: `/${around.next.slug}`, label: around.next.title } : null}
          caption={around.index >= 0 ? `${around.index + 1} / ${around.total}` : undefined}
        />
      </div>
    </main>
  );
}

export default async function FlatPage({ params }: Props) {
  const { slug } = await params;
  const resolved = resolve(slug);

  if (!resolved) notFound();
  if (resolved.kind === "page") {
    const page = await getSitePage(slug);
    if (!page) notFound();
    return <PageBlocks page={page} />;
  }
  if (resolved.kind === "artwork") redirect(resolved.href);
  if (resolved.kind === "portfolio") return <PortfolioView portfolio={resolved.portfolio} />;
  return <ArtistView artist={resolved.artist} />;
}

