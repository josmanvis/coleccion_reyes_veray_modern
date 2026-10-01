/**
 * Editable site content.
 *
 * The public pages used to come from an external API with a hardcoded fallback,
 * so nothing on the site could be changed from the admin. Pages now live in the
 * same SQLite file as the collection, in the block shape `PageBlocks` already
 * renders, and the site reads them from here first.
 */

import { getDb } from "./db";
import { moveToTrash } from "./trash";
import type { Actor } from "./audit";
import { slugifyPage, type Block, type MediaRow, type PageRow, type PageStatus } from "./blocks";

export * from "./blocks";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  blocks TEXT NOT NULL DEFAULT '[]',
  meta_title TEXT,
  meta_description TEXT,
  og_image TEXT,
  nav_label TEXT,
  nav_order INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pages_status ON pages(status);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  mime TEXT,
  bytes INTEGER,
  alt TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

let ready = false;

/** Created lazily so the collection schema in db.ts stays untouched. */
function db() {
  const handle = getDb();
  if (!ready) {
    handle.exec(SCHEMA);
    ready = true;
  }
  return handle;
}

type RawPage = Omit<PageRow, "blocks" | "status"> & { blocks: string; status: string };

function hydrate(row: RawPage): PageRow {
  let blocks: Block[] = [];
  try {
    const parsed = JSON.parse(row.blocks);
    if (Array.isArray(parsed)) blocks = parsed as Block[];
  } catch {
    // A malformed blocks column must not take the whole page down.
    blocks = [];
  }
  return {
    ...row,
    status: row.status === "published" ? "published" : "draft",
    blocks,
  };
}

export function listPages(): PageRow[] {
  return (db().prepare("SELECT * FROM pages ORDER BY nav_order IS NULL, nav_order, title").all() as RawPage[]).map(
    hydrate
  );
}

export function getPageBySlug(slug: string): PageRow | null {
  const row = db().prepare("SELECT * FROM pages WHERE slug = ?").get(slug) as RawPage | undefined;
  return row ? hydrate(row) : null;
}

/** Published only — what the public site is allowed to render. */
export function getPublishedPage(slug: string): PageRow | null {
  const page = getPageBySlug(slug);
  return page && page.status === "published" ? page : null;
}

export function publishedSlugs(): string[] {
  return (
    db().prepare("SELECT slug FROM pages WHERE status = 'published'").all() as Array<{
      slug: string;
    }>
  ).map((r) => r.slug);
}

export type PageInput = Partial<Omit<PageRow, "id" | "created_at" | "updated_at">>;

export function createPage(input: PageInput): PageRow {
  const slug = slugifyPage(String(input.slug ?? input.title ?? ""));
  if (!slug) throw new Error("La página necesita un título o un slug");
  if (getPageBySlug(slug)) throw new Error(`Ya existe una página con el slug "${slug}"`);

  db()
    .prepare(
      `INSERT INTO pages (slug, title, description, status, blocks, meta_title, meta_description, og_image, nav_label, nav_order)
       VALUES (@slug, @title, @description, @status, @blocks, @meta_title, @meta_description, @og_image, @nav_label, @nav_order)`
    )
    .run({
      slug,
      title: String(input.title ?? slug),
      description: input.description ?? null,
      status: input.status === "published" ? "published" : "draft",
      blocks: JSON.stringify(input.blocks ?? []),
      meta_title: input.meta_title ?? null,
      meta_description: input.meta_description ?? null,
      og_image: input.og_image ?? null,
      nav_label: input.nav_label ?? null,
      nav_order: input.nav_order ?? null,
    });

  return getPageBySlug(slug)!;
}

const EDITABLE = [
  "title",
  "description",
  "status",
  "meta_title",
  "meta_description",
  "og_image",
  "nav_label",
  "nav_order",
] as const;

export function updatePage(slug: string, patch: PageInput): PageRow | null {
  const current = getPageBySlug(slug);
  if (!current) return null;

  const updates: Record<string, unknown> = {};
  for (const key of EDITABLE) {
    if (key in patch) updates[key] = patch[key] ?? null;
  }
  if (patch.blocks) updates.blocks = JSON.stringify(patch.blocks);

  // Renaming the slug moves the page's public URL, so it is handled explicitly.
  let nextSlug = current.slug;
  if (patch.slug && slugifyPage(patch.slug) !== current.slug) {
    nextSlug = slugifyPage(patch.slug);
    if (!nextSlug) throw new Error("El slug no puede quedar vacío");
    if (getPageBySlug(nextSlug)) throw new Error(`Ya existe una página con el slug "${nextSlug}"`);
    updates.slug = nextSlug;
  }

  if (Object.keys(updates).length === 0) return current;

  const assignments = Object.keys(updates)
    .map((key) => `${key} = @${key}`)
    .join(", ");
  db()
    .prepare(`UPDATE pages SET ${assignments}, updated_at = datetime('now') WHERE slug = @currentSlug`)
    .run({ ...updates, currentSlug: current.slug });

  return getPageBySlug(nextSlug);
}

/** Moves the page to the trash; returns the trash id, or null when there is none. */
export function deletePage(slug: string, actor?: Actor | null): number | null {
  const page = getPageBySlug(slug);
  if (!page) return null;
  return moveToTrash({
    entity: "pagina",
    entityId: page.slug,
    label: page.title,
    detail: `/${page.slug}`,
    rows: [{ table: "pages", where: "slug = ?", args: [page.slug] }],
    actor,
  });
}

// --- Media -------------------------------------------------------------------

export function listMedia(limit = 200): MediaRow[] {
  return db()
    .prepare("SELECT * FROM media ORDER BY created_at DESC, id DESC LIMIT ?")
    .all(limit) as MediaRow[];
}

export function recordMedia(entry: {
  filename: string;
  url: string;
  mime?: string | null;
  bytes?: number | null;
  alt?: string | null;
}): MediaRow {
  const info = db()
    .prepare(
      "INSERT INTO media (filename, url, mime, bytes, alt) VALUES (@filename, @url, @mime, @bytes, @alt)"
    )
    .run({
      filename: entry.filename,
      url: entry.url,
      mime: entry.mime ?? null,
      bytes: entry.bytes ?? null,
      alt: entry.alt ?? null,
    });

  return db().prepare("SELECT * FROM media WHERE id = ?").get(info.lastInsertRowid) as MediaRow;
}

export function getMedia(id: number): MediaRow | null {
  return (db().prepare("SELECT * FROM media WHERE id = ?").get(id) as MediaRow) ?? null;
}

/** Moves the image and its file to the trash; returns the trash id. */
export function deleteMedia(id: number, actor?: Actor | null): number | null {
  const entry = getMedia(id);
  if (!entry) return null;
  return moveToTrash({
    entity: "imagen",
    entityId: String(id),
    label: entry.filename,
    detail: entry.alt ?? "",
    rows: [{ table: "media", where: "id = ?", args: [id] }],
    files: [{ dir: "uploads", name: entry.filename }],
    actor,
  });
}
