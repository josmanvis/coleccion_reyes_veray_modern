/**
 * The public site's read model, derived from the inventory database.
 *
 * The original WordPress site published a flat page per artist
 * (/alvarez-lezama-manuel) and per artwork (/alvarez-lezama-manuel-0016-2).
 * Those URLs are kept: an artwork already stores its `website_slug`, and an
 * artist's slug is recovered from it by stripping the registro tail, so links
 * that exist in the wild keep working.
 */

import { getDb, type ArtworkRow } from "./db";
import { artistName, normalizeText, titleCase } from "./fields";

export type PublicArtist = {
  slug: string;
  /** "Manuel Álvarez Lezama" */
  name: string;
  artist_last: string;
  artist_first: string | null;
  bio: string | null;
  workCount: number;
};

export type Portfolio = {
  /** Registro shared by every member, e.g. "0012" for 0012.a … 0012.i. */
  base: string;
  slug: string;
  title: string;
  /** The "(caja)" row that represents the portfolio itself, when one exists. */
  parent: ArtworkRow | null;
  members: ArtworkRow[];
};

/**
 * Spreadsheet values are usually typed all-lowercase, but portfolio titles are
 * often already cased ("Poema gris en varias ocasiones"). Only fix the former.
 */
function smartTitle(value: string): string {
  return /[A-ZÁÉÍÓÚÑÜ]/.test(value) ? value : titleCase(value);
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Accent- and case-insensitive identity for one artist. */
export function artistKey(row: Record<string, unknown>): string {
  return `${normalizeText(String(row.artist_last ?? ""))}|${normalizeText(
    String(row.artist_first ?? "")
  )}`;
}

/**
 * "alvarez-lezama-manuel-0016-2" + registro "0016" -> "alvarez-lezama-manuel".
 * Returns null when the slug does not follow the artist+registro pattern, which
 * is the case for the handful of project pages named after the project.
 */
function artistSlugFromArtwork(websiteSlug: string, registro: string): string | null {
  const base = String(registro).replace(/\..*$/, "");
  const withoutCopy = websiteSlug.replace(/-\d+$/, "");
  const patterns = [
    new RegExp(`-0*${base}[a-z]?$`),
    new RegExp(`-${slugify(String(registro))}$`),
  ];
  for (const pattern of patterns) {
    if (pattern.test(withoutCopy)) return withoutCopy.replace(pattern, "");
  }
  return null;
}

type ArtistAccumulator = {
  artist_last: string;
  artist_first: string | null;
  bio: string | null;
  workCount: number;
  slugVotes: Map<string, number>;
};

/**
 * One pass over the collection, grouping works by artist. The original slug is
 * decided by vote because a few artists have works filed under two spellings.
 */
function collectArtists(): Map<string, ArtistAccumulator> {
  const rows = getDb()
    .prepare(
      `SELECT artist_last, artist_first, registro, website_slug, biography
         FROM artworks
        WHERE artist_last IS NOT NULL AND TRIM(artist_last) != ''`
    )
    .all() as Array<{
    artist_last: string;
    artist_first: string | null;
    registro: string;
    website_slug: string | null;
    biography: string | null;
  }>;

  const artists = new Map<string, ArtistAccumulator>();

  for (const row of rows) {
    const key = artistKey(row);
    let artist = artists.get(key);
    if (!artist) {
      artist = {
        artist_last: row.artist_last,
        artist_first: row.artist_first,
        bio: null,
        workCount: 0,
        slugVotes: new Map(),
      };
      artists.set(key, artist);
    }

    artist.workCount++;
    // Keep the longest biography on file; some rows carry a truncated copy.
    if (row.biography && (!artist.bio || row.biography.length > artist.bio.length)) {
      artist.bio = row.biography;
    }
    if (row.website_slug) {
      const slug = artistSlugFromArtwork(row.website_slug, row.registro);
      if (slug) artist.slugVotes.set(slug, (artist.slugVotes.get(slug) ?? 0) + 1);
    }
  }

  return artists;
}

function resolveSlug(artist: ArtistAccumulator): string {
  let best: string | null = null;
  let bestCount = 0;
  for (const [slug, count] of artist.slugVotes) {
    if (count > bestCount || (count === bestCount && best !== null && slug < best)) {
      best = slug;
      bestCount = count;
    }
  }
  if (best) return best;
  // No original page to inherit from — follow the site's "apellido-nombre" shape.
  return slugify([artist.artist_last, artist.artist_first].filter(Boolean).join(" "));
}

function toPublicArtist(artist: ArtistAccumulator): PublicArtist {
  return {
    slug: resolveSlug(artist),
    name: artistName({
      artist_first: artist.artist_first,
      artist_last: artist.artist_last,
    }),
    artist_last: artist.artist_last,
    artist_first: artist.artist_first,
    bio: artist.bio,
    workCount: artist.workCount,
  };
}

/** Every artist, alphabetical by surname — the order the index page lists them in. */
export function listArtists(): PublicArtist[] {
  const artists = [...collectArtists().values()].map(toPublicArtist);

  // Two artists can collapse onto one slug; keep the busier one at the clean
  // URL and suffix the other so both stay reachable.
  const taken = new Map<string, number>();
  for (const artist of artists.sort((a, b) => b.workCount - a.workCount)) {
    const seen = taken.get(artist.slug) ?? 0;
    taken.set(artist.slug, seen + 1);
    if (seen > 0) artist.slug = `${artist.slug}-${seen + 1}`;
  }

  return artists.sort((a, b) =>
    normalizeText(a.artist_last).localeCompare(normalizeText(b.artist_last), "es") ||
    normalizeText(a.artist_first ?? "").localeCompare(normalizeText(b.artist_first ?? ""), "es")
  );
}

export function getArtistBySlug(slug: string): PublicArtist | null {
  return listArtists().find((artist) => artist.slug === slug) ?? null;
}

/** The artist's works, newest registro last, so the grid reads like the original. */
export function artistWorks(artist: PublicArtist): ArtworkRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM artworks
        WHERE artist_last IS @last AND artist_first IS @first
        ORDER BY registro ASC`
    )
    .all({ last: artist.artist_last, first: artist.artist_first }) as ArtworkRow[];
}

// --- Portfolios --------------------------------------------------------------

/**
 * Registros like "0012.a" mark a sheet inside a portfolio; "0012" is the
 * portfolio itself. Suffixes run a, b, … z, aa, bb, so they sort by length
 * first — plain alphabetical would put "aa" between "a" and "b".
 */
export function portfolioBase(registro: string): string | null {
  const match = String(registro).match(/^([^.]+)\.(.+)$/);
  return match ? match[1] : null;
}

function memberOrder(row: ArtworkRow): [number, number, string] {
  const suffix = String(row.registro).split(".")[1] ?? "";
  // Members are often titled "27. acerola", which is the authoritative order.
  // The period matters: "1873-1973 (del portafolio Esclavitud)" is a date.
  const numbered = String(row.title ?? "").match(/^\s*(\d{1,3})\s*\.\s/);
  return [numbered ? Number(numbered[1]) : Number.MAX_SAFE_INTEGER, suffix.length, suffix];
}

function sortMembers(rows: ArtworkRow[]): ArtworkRow[] {
  return [...rows].sort((a, b) => {
    const [an, al, as] = memberOrder(a);
    const [bn, bl, bs] = memberOrder(b);
    return an - bn || al - bl || as.localeCompare(bs);
  });
}

/** Pulls the portfolio's name out of "rescate (del portafolio Esclavitud)". */
function titleFromMembers(members: ArtworkRow[]): string | null {
  for (const row of members) {
    const match = String(row.title ?? "").match(
      /\(\s*(?:del\s+)?portafolios?\s+([^)]+)\)/i
    );
    if (match) return smartTitle(match[1].trim());
  }
  return null;
}

export function getPortfolio(base: string): Portfolio | null {
  const db = getDb();
  const members = sortMembers(
    db
      .prepare("SELECT * FROM artworks WHERE registro LIKE @like ORDER BY registro")
      .all({ like: `${base}.%` }) as ArtworkRow[]
  );
  if (members.length === 0) return null;

  const siblings = db
    .prepare("SELECT * FROM artworks WHERE registro = @base ORDER BY id")
    .all({ base }) as ArtworkRow[];
  // The "(caja)" row describes the portfolio; the others are its front matter.
  const parent =
    siblings.find((row) => /caja|portafolio|portfolio/i.test(String(row.title ?? ""))) ??
    siblings[0] ??
    null;

  const rawTitle = parent ? String(parent.title ?? "") : "";
  const title =
    titleFromMembers(members) ??
    (rawTitle
      ? smartTitle(rawTitle.split("\n")[0].replace(/\(caja\)/i, "").trim())
      : `Portafolio ${base}`);

  return {
    base,
    slug: `portafolio-${base}`,
    title,
    parent,
    members,
  };
}

/** Every portfolio in the collection, largest first. */
export function listPortfolios(): Portfolio[] {
  const bases = (
    getDb()
      .prepare(
        `SELECT DISTINCT substr(registro, 1, instr(registro, '.') - 1) AS base
           FROM artworks WHERE registro LIKE '%.%'`
      )
      .all() as Array<{ base: string }>
  )
    .map((row) => row.base)
    .filter(Boolean);

  return bases
    .map(getPortfolio)
    .filter((p): p is Portfolio => p !== null)
    .sort((a, b) => b.members.length - a.members.length || a.base.localeCompare(b.base));
}

// --- Previous / next ---------------------------------------------------------

export type Neighbours<T> = { previous: T | null; next: T | null; index: number; total: number };

/** Position of `id` in `items`, with the entries either side of it. */
export function neighbours<T>(
  items: T[],
  isCurrent: (item: T) => boolean
): Neighbours<T> {
  const index = items.findIndex(isCurrent);
  if (index === -1) return { previous: null, next: null, index: -1, total: items.length };
  return {
    previous: index > 0 ? items[index - 1] : null,
    next: index < items.length - 1 ? items[index + 1] : null,
    index,
    total: items.length,
  };
}

export function artistNeighbours(slug: string): Neighbours<PublicArtist> {
  return neighbours(listArtists(), (artist) => artist.slug === slug);
}

/** An artwork's siblings: its portfolio when it belongs to one, else its artist's works. */
export function artworkNeighbours(artwork: ArtworkRow): {
  withinArtist: Neighbours<ArtworkRow>;
  withinPortfolio: Neighbours<ArtworkRow> | null;
  portfolio: Portfolio | null;
} {
  const artist = listArtists().find((a) => artistKey(a as unknown as Record<string, unknown>) === artistKey(artwork as unknown as Record<string, unknown>)) ?? null;
  const withinArtist = artist
    ? neighbours(artistWorks(artist), (row) => row.ref === artwork.ref)
    : { previous: null, next: null, index: -1, total: 0 };

  const base = portfolioBase(String(artwork.registro));
  const portfolio = base ? getPortfolio(base) : null;
  const withinPortfolio = portfolio
    ? neighbours(portfolio.members, (row) => row.ref === artwork.ref)
    : null;

  return { withinArtist, withinPortfolio, portfolio };
}

export function getArtworkBySlug(slug: string): ArtworkRow | null {
  return (
    (getDb()
      .prepare("SELECT * FROM artworks WHERE website_slug = ? LIMIT 1")
      .get(slug) as ArtworkRow) ?? null
  );
}

/**
 * artistKey -> public slug, built once so a table of rows can link every artist
 * without re-deriving the whole index per row.
 */
export function artistSlugIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const artist of listArtists()) {
    index.set(artistKey(artist as unknown as Record<string, unknown>), artist.slug);
  }
  return index;
}

/** The public artist page for a row, or null when the row has no artist. */
export function artistHrefFor(
  row: Record<string, unknown>,
  index: Map<string, string>
): string | null {
  const slug = index.get(artistKey(row));
  return slug ? `/${slug}` : null;
}
