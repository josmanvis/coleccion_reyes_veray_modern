/**
 * Server-side data layer for the Axxes Club (BAC) public API.
 * Every getter falls back to bundled local data if BAC is unreachable,
 * so the site degrades gracefully instead of failing.
 */

const MAC_BASE = process.env.MAC_API_BASE || "https://members.axxes.club";
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
    const res = await fetch(`${MAC_BASE}/api/v1/public/tenants/${TENANT}${path}`, {
      next: { revalidate },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
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
        .map((img) => img.url)
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
    images: (a.images as string[]) || [],
    description: a.description as string | undefined,
    ut_thumb: a.ut_thumb as string | undefined,
    ut_high: a.ut_high as string | undefined,
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
  const product = await macFetch<MacProduct | { error: string }>(
    `/inventory?slug=${encodeURIComponent(slug)}`,
    3600
  );
  if (product && !("error" in product) && (product as MacProduct).name) {
    return toArtwork(product as MacProduct);
  }
  const local = await localArtworks();
  return findLocal(slug, local) || null;
}

/** Featured artworks for the homepage. */
export async function getFeaturedArtworks(limit = 4): Promise<Artwork[]> {
  const inventory = await macFetch<MacProduct[]>("/inventory?featured=true", 3600);
  if (inventory && Array.isArray(inventory) && inventory.length > 0) {
    return inventory.slice(0, limit).map(toArtwork);
  }
  const local = await localArtworks();
  return local.slice(0, limit);
}

/** A CMS page (about, exhibitions, etc.) published in BAC. */
export async function getPage(pageSlug: string): Promise<MacPage | null> {
  return macFetch<MacPage>(`/pages/${encodeURIComponent(pageSlug)}`, 3600);
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
}): Promise<boolean> {
  try {
    const res = await fetch(`${MAC_BASE}/api/v1/public/tenants/${TENANT}/inquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}