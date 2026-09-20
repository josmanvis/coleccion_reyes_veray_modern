/**
 * Seeds the CMS with the site's editorial pages.
 *
 *   npx tsx scripts/seed-pages.ts
 *
 * Existing pages are left alone, so re-running never clobbers edits made in the
 * admin. Content comes from the WordPress scrape where a real page exists.
 */
import fs from "node:fs";
import path from "node:path";
import { createPage, getPageBySlug, type Block } from "../src/lib/inventory/pages";

type WpPage = {
  slug: string;
  title: { rendered: string } | string;
  content?: { rendered: string };
};

const SCRAPE = path.join(process.cwd(), "data", "wordpress", "pages.json");

/**
 * WordPress page-builder markup is mostly layout scaffolding — nested divs with
 * `row`, `col` and `clearfix` classes. Unwrap it and keep the editorial tags, so
 * what lands in the editor is text the owner can actually read and change.
 */
const KEEP = new Set(["p", "br", "strong", "b", "em", "i", "u", "a", "ul", "ol", "li", "blockquote"]);

function cleanHtml(html: string): string {
  let out = html
    .replace(/<(script|style|noscript|iframe)[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Drop every tag that is not editorial; keep only href on links.
  out = out.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tag: string, attrs: string) => {
    const name = tag.toLowerCase();
    if (!KEEP.has(name)) return "";
    if (match.startsWith("</")) return `</${name}>`;
    if (name === "a") {
      const href = attrs.match(/href=["']([^"']+)["']/i)?.[1];
      return href ? `<a href="${href}">` : "<a>";
    }
    return `<${name}>`;
  });

  return out
    .replace(/(&nbsp;|\u00a0)/g, " ")
    .replace(/<p>\s*<\/p>/gi, "")
    .replace(/\s*\n\s*\n\s*/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Splits WordPress HTML into the block types the site renders. */
function toBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  // Top-level chunks: headings, images and figures become their own blocks;
  // everything else is kept as HTML in a text block.
  const parts = html.split(/(?=<h[1-3][\s>])|(?=<figure[\s>])|(?=<img[\s>])|(?=<hr\s*\/?>)/i);

  for (const raw of parts) {
    const chunk = raw.trim();
    if (!chunk) continue;

    const heading = chunk.match(/^<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/i);
    if (heading) {
      const text = heading[2].replace(/<[^>]+>/g, "").trim();
      if (text) blocks.push({ type: "heading", content: { level: `h${heading[1]}`, text } });
      const rest = cleanHtml(chunk.slice(heading[0].length));
      if (rest) blocks.push({ type: "text", content: { html: rest } });
      continue;
    }

    if (/^<hr/i.test(chunk)) {
      blocks.push({ type: "divider", content: {} });
      continue;
    }

    const img = chunk.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    if (img && /^<(figure|img)/i.test(chunk)) {
      const alt = chunk.match(/alt=["']([^"']*)["']/i)?.[1] ?? "";
      const caption = chunk.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] ?? "";
      blocks.push({
        type: "image",
        content: { url: img[1], alt, caption: caption.replace(/<[^>]+>/g, "").trim() },
      });
      continue;
    }

    const text = cleanHtml(chunk);
    if (text) blocks.push({ type: "text", content: { html: text } });
  }

  return blocks;
}

function titleOf(page: WpPage): string {
  const t = typeof page.title === "string" ? page.title : page.title.rendered;
  return t.replace(/&#8211;/g, "–").replace(/&#038;/g, "&").replace(/&amp;/g, "&").trim();
}

/** Pages the owner asked to carry over, plus the site's own editorial pages. */
const WANTED: Array<{ slug: string; from?: string; title?: string; status?: "published" | "draft" }> = [
  { slug: "about", from: undefined, title: "About", status: "draft" },
  { slug: "libro", from: "libro", status: "draft" },
  { slug: "motivos-indigenas-de-puerto-rico", from: "motivos-indigenas-de-puerto-rico", status: "draft" },
  { slug: "la-exposicion", from: "la-exposicion-the-exhibition", title: "La Exposición / The Exhibition", status: "draft" },
  { slug: "catalogo-exposicion", from: "prueba", title: "Catálogo Exposición", status: "draft" },
];

function main() {
  const scraped: WpPage[] = fs.existsSync(SCRAPE)
    ? JSON.parse(fs.readFileSync(SCRAPE, "utf8"))
    : [];
  const bySlug = new Map(scraped.map((p) => [p.slug, p]));

  let created = 0;
  let skipped = 0;

  for (const want of WANTED) {
    if (getPageBySlug(want.slug)) {
      skipped++;
      console.log(`  = ${want.slug} (ya existe, sin tocar)`);
      continue;
    }

    const source = want.from ? bySlug.get(want.from) : undefined;
    const html = source?.content?.rendered ?? "";
    const blocks = html ? toBlocks(html) : [];

    createPage({
      slug: want.slug,
      title: want.title ?? (source ? titleOf(source) : want.slug),
      status: want.status ?? "draft",
      blocks,
    });
    created++;
    console.log(`  + ${want.slug} — ${blocks.length} bloques`);
  }

  console.log(`\nListo. ${created} creadas, ${skipped} ya existían.`);
}

main();
