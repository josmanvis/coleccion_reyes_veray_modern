import { unstable_cache } from "next/cache";
import { readGcpCatalog, saveGcpInquiry } from "./gcp-catalog";
import { readSnapshotCatalog } from "./snapshot-catalog";
import { resolveImage, resolvePageImages } from "./resolve-image";
/**
 * Server-side data layer for the Axxes Club (BAC) public API.
 * Every getter falls back to bundled local data if BAC is unreachable,
 * so the site degrades gracefully instead of failing.
 */

const MAC_BASE = process.env.MAC_API_BASE;
const TENANT = "coleccion-reyes-veray";

export type Artwork = {
  title: string;
  url: string;
  images: string[];
  description?: string;
  ut_thumb?: string;
  ut_high?: string;
  slug: string;
  id?: string;
  price?: number | null;
  currency?: string | null;
  tags?: string[];
};

export type MacPage = {
  title: string;
  slug: string;
  description: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  isHomepage: boolean;
  blocks: Array<{
    type: string;
    content: Record<string, unknown>;
    settings: Record<string, unknown> | null;
  }>;
};

async function macFetch<T>(path: string, revalidate = 3600): Promise<T | null> {
  try {
    if (process.env.ORC_DATABASE_URL) {
      return await unstable_cache(() => readGcpCatalog(path), ["orc-catalog", path], {revalidate})() as T;
    }
    if (!MAC_BASE) return await readSnapshotCatalog(path) as T;
    const res = await fetch(`${MAC_BASE}/api/v1/public/tenants/${TENANT}${path}`, {
      next: { revalidate },
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
    if (!res.ok || !res.headers.get("content-type")?.includes("application/json")) return null;
    return (await res.json()) as T;
  } catch {
    console.error("GCP catalog read failed; serving the verified collection snapshot");
    return await readSnapshotCatalog(path) as T;
  }
}

type MacProduct = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  shortDescription: string | null;
  price: string;
  currency: string | null;
  images: Array<{ url: string; alt?: string; position: number }> | null;
  tags: string[] | null;
  isFeatured: boolean | null;
};

function toArtwork(item: MacProduct): Artwork {
  const sortedImages = Array.isArray(item.images)
    ? [...item.images]
        .sort((a, b) => (a.position || 0) - (b.position || 0))
        .map((img) => resolveImage(img.url))
        .filter(Boolean)
    : [];

  const slug = item.slug || (item.id ? item.id : "");

  return {
    id: item.id,
    title: item.name,
    slug,
    url: `/${slug}`,
    images: sortedImages,
    description: item.description || item.shortDescription || undefined,
    price: item.price ? parseFloat(item.price) : null,
    currency: item.currency,
    tags: item.tags || [],
  };
}

/** Local fallback dataset (bundled snapshot of the collection) */
async function localArtworks(): Promise<Artwork[]> {
  const data = (await import("@/data/artworks.json")).default;
  return data.map((a: Record<string, unknown>) => ({
    title: a.title as string,
    url: a.url as string,
    slug: (a.url as string).replace(/^\//, "").replace(/\/index\.html$/, ""),
    images: ((a.images as string[]) || []).map(resolveImage),
    description: a.description as string | undefined,
    ut_thumb: a.ut_thumb ? resolveImage(a.ut_thumb as string) : undefined,
    ut_high: a.ut_high ? resolveImage(a.ut_high as string) : undefined,
  }));
}

function findLocal(url: string, local: Artwork[]): Artwork | undefined {
  return local.find(
    (a) => a.url === `/${url}/index.html` || a.url === `/${url}` || a.slug === url
  );
}

/** All active artworks in the collection. */
export async function getArtworks(): Promise<Artwork[]> {
  const inventory = await macFetch<MacProduct[]>("/inventory");
  if (inventory && Array.isArray(inventory) && inventory.length > 0) {
    return inventory.map(toArtwork);
  }
  console.error("MAC inventory unavailable, falling back to local JSON");
  return localArtworks();
}

export type Artist = {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  lifespan: string | null;
  artworkCount: number;
};

/**
 * Artists represented in the collection, from the AXXES public API.
 *
 * These used to be imported as image-less "products" with a `glossary/` slug
 * prefix; they are now first-class records, so this has no local fallback and
 * degrades to an empty list rather than inventing data.
 */
export async function getArtists(): Promise<Artist[]> {
  const rows = await macFetch<Artist[]>("/artists", 86400);
  if (rows && Array.isArray(rows)) {
    return rows;
  }
  console.error("MAC artists unavailable");
  return [];
}

export async function getArtist(slug: string): Promise<Artist | null> {
  const rows = await macFetch<Artist[]>(`/artists?slug=${encodeURIComponent(slug)}`, 86400);
  if (Array.isArray(rows) && rows.length > 0) return rows[0];
  return null;
}

export type ArtworkIndexEntry = {
  slug: string;
  title: string;
  image: string | null;
};

/**
 * Title + thumbnail for every work, for grouping works under an artist.
 *
 * Deliberately not getArtworks(): the full inventory is ~8MB for this tenant,
 * which is over Next.js's 2MB data-cache ceiling, so it is never cached and is
 * re-downloaded on every render. With one page per artist that turned a
 * 3-minute build into one that did not finish in 12 minutes. This shape is
 * ~300KB and caches, so the whole 591-page build fetches it once.
 */
export async function getArtworkIndex(): Promise<ArtworkIndexEntry[]> {
  const rows = await macFetch<ArtworkIndexEntry[]>(
    "/inventory?fields=artistIndex",
    86400
  );
  if (rows && Array.isArray(rows)) {
    return rows.map(row => ({ ...row, image: row.image ? resolveImage(row.image) : null }));
  }
  console.error("MAC artwork index unavailable, falling back to local JSON");
  const local = await localArtworks();
  return local.map((a) => ({
    slug: a.slug,
    title: a.title,
    image: a.images[0] ?? null,
  }));
}

/** Slim slug list for static generation. */
export async function getArtworkSlugs(): Promise<string[]> {
  const slugs = await macFetch<string[] | Array<{ slug: string | null; name?: string }>>(
    "/inventory?fields=slugs",
    86400
  );
  if (Array.isArray(slugs) && slugs.length > 0) {
    // Newer BAC returns string slugs; older returns full product objects — normalize both
    const normalized = slugs
      .map((s) => (typeof s === "string" ? s : (s.slug || "")))
      .filter((s): s is string => Boolean(s));
    if (normalized.length > 0) return normalized;
  }
  const local = await localArtworks();
  return local.map((a) => a.slug).filter(Boolean);
}

/** A single artwork by slug. */
export async function getArtwork(slug: string): Promise<Artwork | null> {
  const result = await macFetch<MacProduct | MacProduct[] | { error: string }>(
    `/inventory?slug=${encodeURIComponent(slug)}`,
    3600
  );
  // BAC's /inventory returns a collection even when filtered to a single slug;
  // older builds returned a bare object. Accept both.
  const product = Array.isArray(result) ? result[0] : result;
  if (product && !("error" in product) && (product as MacProduct).name) {
    return toArtwork(product as MacProduct);
  }
  const local = await localArtworks();
  return findLocal(slug, local) || null;
}

/** Featured artworks for the homepage. */
export async function getFeaturedArtworks(limit = 4): Promise<Artwork[]> {
  const inventory = await macFetch<MacProduct[]>(`/inventory?featured=true&limit=${limit}`, 3600);
  if (inventory && Array.isArray(inventory) && inventory.length > 0) {
    return inventory.slice(0, limit).map(toArtwork);
  }
  const local = await localArtworks();
  return local.slice(0, limit);
}

/** A CMS page (about, exhibitions, etc.) published in BAC. */
export async function getPage(pageSlug: string): Promise<MacPage | null> {
  const page = await macFetch<MacPage>(`/pages/${encodeURIComponent(pageSlug)}`, 3600);
  return page ? resolvePageImages(page) : null;
}

/** Site settings (footer style, analytics, etc.) from BAC. */
export type SiteSettings = {
  tenant: { name: string; slug: string; email?: string | null };
  settings: {
    customDomain?: string | null;
    subdomain?: string | null;
    navigationStyle: string;
    footerStyle: string;
    showPoweredBy?: string | null;
    defaultOgImage?: string | null;
    footerText?: string | null;
  } | null;
};

export async function getSiteSettings(): Promise<SiteSettings | null> {
  return macFetch<SiteSettings>("/settings", 86400);
}

/** Submit an acquisition/general inquiry into the BAC CRM. */
export async function submitInquiry(payload: {
  name?: string;
  email: string;
  phone?: string;
  message?: string;
  artworkTitle?: string;
  artworkSlug?: string;
  artworkImage?: string;
  source?: string;
  submissionId?: string;
}): Promise<boolean> {
  try {
    if (process.env.ORC_DATABASE_URL) return await saveGcpInquiry(payload);
    if (!MAC_BASE) return false;
    const res = await fetch(`${MAC_BASE}/api/v1/public/tenants/${TENANT}/inquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    });
    if (!res.ok || !res.headers.get("content-type")?.includes("application/json")) return false;
    const result = await res.json();
    return result.ok === true && typeof result.contactId === "string";
  } catch {
    return false;
  }
}
/** Gallery listing uses the cacheable slim index rather than the 8 MB inventory. */
export async function getGalleryArtworks(): Promise<Artwork[]> {
  const index = await getArtworkIndex();
  const local = (await import("@/data/artworks.json")).default;
  const descriptions = new Map(local.map(a => [a.url.replace(/^\//, "").replace(/\/index\.html$/, ""), a.description]));
  return index.map(a => ({title: a.title, slug: a.slug, url: `/${a.slug}`, images: a.image ? [a.image] : [], description: descriptions.get(a.slug)?.slice(0, 500)}));
}
