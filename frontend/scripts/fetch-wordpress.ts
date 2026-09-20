/**
 * Pulls the live WordPress site down into data/wordpress/ as JSON via the
 * public REST API — pages (the artwork records) and media (the image library).
 *
 *   npm run wp:fetch
 *
 * Requests are sequential with a short pause so the shared host is not hammered.
 */
import fs from "node:fs/promises";
import path from "node:path";

const ORIGIN = process.env.WP_ORIGIN || "https://coleccionreyesveray.com";
const OUT_DIR = path.join(process.cwd(), "data", "wordpress");
const PER_PAGE = 100;
const PAUSE_MS = 250;

type Json = Record<string, unknown>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The shared host drops connections under sustained load, so back off and retry. */
async function fetchWithRetry(url: string, attempts = 5): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "coleccion-reyes-veray-inventory/1.0" },
        signal: AbortSignal.timeout(45_000),
      });
      if (response.status >= 500 && attempt < attempts) {
        await sleep(attempt * 2000);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(attempt * 2000);
    }
  }
  throw new Error(`No se pudo descargar ${url}: ${(lastError as Error)?.message ?? "desconocido"}`);
}

async function fetchAll(resource: string, fields: string[], outFile: string): Promise<Json[]> {
  const collected: Json[] = [];
  const query = new URLSearchParams({
    per_page: String(PER_PAGE),
    _fields: fields.join(","),
    orderby: "id",
    order: "asc",
  });

  for (let page = 1; ; page++) {
    query.set("page", String(page));
    const url = `${ORIGIN}/wp-json/wp/v2/${resource}?${query}`;
    const response = await fetchWithRetry(url);

    if (response.status === 400) break; // past the last page
    if (!response.ok) {
      throw new Error(`${resource} página ${page}: HTTP ${response.status}`);
    }

    const batch = (await response.json()) as Json[];
    if (batch.length === 0) break;
    collected.push(...batch);

    // Flush as we go so a dropped connection never costs the whole download.
    await fs.writeFile(outFile, JSON.stringify(collected, null, 2));

    const total = Number(response.headers.get("x-wp-totalpages") || "1");
    process.stdout.write(`\r  ${resource}: ${collected.length} (página ${page}/${total})   `);
    if (page >= total) break;
    await sleep(PAUSE_MS);
  }

  process.stdout.write("\n");
  return collected;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  console.log(`Descargando ${ORIGIN} → ${path.relative(process.cwd(), OUT_DIR)}`);

  const pages = await fetchAll(
    "pages",
    ["id", "slug", "link", "date", "modified", "title", "content", "excerpt", "featured_media", "parent"],
    path.join(OUT_DIR, "pages.json")
  );

  const media = await fetchAll(
    "media",
    ["id", "slug", "date", "title", "alt_text", "caption", "media_details", "source_url", "post"],
    path.join(OUT_DIR, "media.json")
  );

  const manifest = {
    origin: ORIGIN,
    fetchedAt: new Date().toISOString(),
    counts: { pages: pages.length, media: media.length },
  };
  await fs.writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`\nListo. ${pages.length} páginas · ${media.length} archivos de medios.`);
}

main().catch((error) => {
  console.error("\n" + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
