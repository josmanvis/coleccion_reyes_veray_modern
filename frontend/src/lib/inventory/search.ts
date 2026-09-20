import Fuse from "fuse.js";
import { getDb } from "./db";
import { normalizeText } from "./fields";

type IndexedRow = {
  ref: string;
  registro: string;
  title: string;
  artist: string;
  technique: string;
  support: string;
  location: string;
  status: string;
  notes: string;
};

/**
 * Typo-tolerant search over the whole collection. The table is small enough
 * (a few thousand rows) to keep an in-memory index, rebuilt only when the data
 * actually changes.
 */
let cache: { signature: string; fuse: Fuse<IndexedRow> } | null = null;

function signature(): string {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n, COALESCE(MAX(updated_at), '') AS t FROM artworks")
    .get() as { n: number; t: string };
  return `${row.n}:${row.t}`;
}

function buildIndex(): Fuse<IndexedRow> {
  const rows = getDb()
    .prepare(
      `SELECT ref, registro, title, artist_last, artist_first, artist_alias,
              technique, support, location, status, notes
       FROM artworks`
    )
    .all() as Array<Record<string, string | null>>;

  // Accents are stripped on both sides so "tavarez" matches "Tavárez".
  const documents: IndexedRow[] = rows.map((row) => ({
    ref: String(row.ref),
    registro: String(row.registro ?? ""),
    title: normalizeText(row.title ?? ""),
    artist: normalizeText(
      [row.artist_first, row.artist_last, row.artist_alias].filter(Boolean).join(" ")
    ),
    technique: normalizeText(row.technique ?? ""),
    support: normalizeText(row.support ?? ""),
    location: normalizeText(row.location ?? ""),
    status: normalizeText(row.status ?? ""),
    notes: normalizeText(row.notes ?? ""),
  }));

  return new Fuse(documents, {
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.26,
    minMatchCharLength: 2,
    // Weights are deliberately close: heavily favouring title made a loose
    // title match outrank an near-exact match on technique or artist.
    keys: [
      { name: "title", weight: 2 },
      { name: "artist", weight: 2 },
      { name: "registro", weight: 2 },
      { name: "technique", weight: 2 },
      { name: "support", weight: 1 },
      { name: "location", weight: 1 },
      { name: "status", weight: 0.5 },
      { name: "notes", weight: 0.5 },
    ],
  });
}

function index(): Fuse<IndexedRow> {
  const current = signature();
  if (!cache || cache.signature !== current) {
    cache = { signature: current, fuse: buildIndex() };
  }
  return cache.fuse;
}

/** Refs that match the query, best match first. */
export function fuzzyRefs(query: string): string[] {
  const normalized = normalizeText(query);
  if (!normalized) return [];
  return index()
    .search(normalized)
    .map((hit) => hit.item.ref);
}
