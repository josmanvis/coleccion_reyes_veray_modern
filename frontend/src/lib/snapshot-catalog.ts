/** Verified Cloud SQL snapshot keeps builds offline and serves reads during outages. */
export async function readSnapshotCatalog(path: string): Promise<unknown> {
  const data = (await import("@/data/site-snapshot.json")).default;
  const url = new URL(path, "https://orc.axxes.app");
  if (url.pathname === "/inventory") {
    let rows = data.inventory;
    const slug = url.searchParams.get("slug");
    if (slug) rows = rows.filter(row => row.slug === slug);
    if (url.searchParams.get("featured") === "true") rows = rows.filter(row => row.isFeatured);
    if (url.searchParams.get("fields") === "slugs") return rows.map(row => row.slug).filter(Boolean);
    if (url.searchParams.get("fields") === "artistIndex") return rows.map(row => ({slug:row.slug,title:row.name,image:row.images?.[0]?.url ?? null}));
    const limit = Math.max(1,Math.min(5000,Number(url.searchParams.get("limit")) || 5000));
    return rows.slice(0,limit);
  }
  if (url.pathname === "/artists") {
    const slug=url.searchParams.get("slug");return slug ? data.artists.filter(row=>row.slug===slug) : data.artists;
  }
  if (url.pathname.startsWith("/pages/")) return data.pages.find(page=>page.slug===decodeURIComponent(url.pathname.slice(7))) ?? null;
  if (url.pathname === "/settings") return data.settings;
  return null;
}
