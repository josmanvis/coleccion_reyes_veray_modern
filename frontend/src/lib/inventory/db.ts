import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import {
  FIELDS,
  FIELD_BY_KEY,
  READONLY_KEYS,
  type Field,
  normalizeText,
  statusGroupOf,
  parseMoney,
  parseInteger,
} from "./fields";
import { fuzzyRefs } from "./search";

export type ArtworkRow = Record<string, string | number | null> & {
  id: number;
  ref: string;
  registro: string;
  status_group: string;
  image_thumb: string | null;
  image_full: string | null;
  website_slug: string | null;
  updated_at: string;
};

const DB_PATH =
  process.env.INVENTORY_DB_PATH || path.join(process.cwd(), "data", "inventory.db");

function sqlType(field: Field): string {
  if (field.type === "int") return "INTEGER";
  if (field.type === "money") return "REAL";
  return "TEXT";
}

export const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS artworks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT NOT NULL UNIQUE,
${FIELDS.map((f) => `  ${f.key} ${sqlType(f)}`).join(",\n")},
  status_group TEXT NOT NULL DEFAULT 'sin_estatus',
  search_blob TEXT,
  image_thumb TEXT,
  image_full TEXT,
  website_slug TEXT,
  raw_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_artworks_registro ON artworks(registro);
CREATE INDEX IF NOT EXISTS idx_artworks_artist ON artworks(artist_last, artist_first);
CREATE INDEX IF NOT EXISTS idx_artworks_status ON artworks(status_group);
CREATE INDEX IF NOT EXISTS idx_artworks_year ON artworks(year);
CREATE INDEX IF NOT EXISTS idx_artworks_search ON artworks(search_blob);
`;

let handle: Database.Database | null = null;

export function getDb(): Database.Database {
  if (handle) return handle;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(CREATE_SQL);
  handle = db;
  return db;
}

export function closeDb() {
  handle?.close();
  handle = null;
}

export function databaseExists(): boolean {
  return fs.existsSync(DB_PATH);
}

export function databasePath(): string {
  return DB_PATH;
}

/** Recomputes the columns the UI filters and searches on. */
export function derived(values: Record<string, unknown>) {
  const blob = FIELDS.filter((f) => f.search)
    .map((f) => values[f.key])
    .filter((v) => v !== null && v !== undefined && v !== "")
    .join(" ");
  return {
    status_group: statusGroupOf(values.status as string | null),
    search_blob: normalizeText(blob),
  };
}

export function coerce(field: Field, value: unknown): string | number | null {
  if (value === null || value === undefined || value === "") return null;
  if (field.type === "money") return parseMoney(value);
  if (field.type === "int") return parseInteger(value);
  return String(value).trim() || null;
}

export type ListParams = {
  q?: string;
  statusGroup?: string;
  artist?: string;
  medium?: string;
  technique?: string;
  support?: string;
  location?: string;
  acquisitionMethod?: string;
  birthPlace?: string;
  category?: string;
  yearMin?: number;
  yearMax?: number;
  withImage?: boolean;
  withoutImage?: boolean;
  /** true = only works marked for sale, false = only those not marked. */
  forSale?: boolean;
  sort?: string;
  dir?: "asc" | "desc";
  page?: number;
  limit?: number;
};

const SORTABLE: Record<string, string> = {
  registro: "registro",
  title: "title",
  artist: "artist_last, artist_first",
  year: "year",
  purchase_price: "purchase_price",
  current_value: "current_value",
  updated_at: "updated_at",
};

const FILTER_COLUMNS: Record<string, string> = {
  artist: "artist_last",
  medium: "medium",
  technique: "technique",
  support: "support",
  location: "location",
  acquisitionMethod: "acquisition_method",
  birthPlace: "artist_birth_place",
  category: "category",
};

/** Only the "V1" code in the free-text Ventas column means offered for sale. */
const FOR_SALE_SQL = "TRIM(COALESCE(sales, '')) LIKE 'v1%'";

function buildWhere(params: ListParams) {
  const clauses: string[] = [];
  const args: Record<string, unknown> = {};

  if (params.statusGroup) {
    clauses.push("status_group = @statusGroup");
    args.statusGroup = params.statusGroup;
  }
  for (const [param, column] of Object.entries(FILTER_COLUMNS)) {
    const value = params[param as keyof ListParams];
    if (typeof value === "string" && value) {
      clauses.push(`${column} = @${param}`);
      args[param] = value;
    }
  }
  if (typeof params.yearMin === "number") {
    clauses.push("year >= @yearMin");
    args.yearMin = params.yearMin;
  }
  if (typeof params.yearMax === "number") {
    clauses.push("year <= @yearMax");
    args.yearMax = params.yearMax;
  }
  if (params.withImage) clauses.push("image_thumb IS NOT NULL");
  if (params.withoutImage) clauses.push("image_thumb IS NULL");
  if (params.forSale === true) clauses.push(FOR_SALE_SQL);
  if (params.forSale === false) clauses.push(`NOT (${FOR_SALE_SQL})`);

  return { sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", args };
}

function named(refs: string[], prefix: string) {
  return {
    placeholders: refs.map((_, i) => `@${prefix}${i}`).join(", "),
    args: Object.fromEntries(refs.map((ref, i) => [`${prefix}${i}`, ref])),
  };
}

export function listArtworks(params: ListParams) {
  const db = getDb();
  const { sql: where, args } = buildWhere(params);
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 500);
  const page = Math.max(params.page ?? 1, 1);
  const orderBy = SORTABLE[params.sort ?? "registro"] ?? SORTABLE.registro;
  const dir = params.dir === "desc" ? "DESC" : "ASC";
  const empty = { rows: [] as ArtworkRow[], total: 0, page, limit, pages: 1 };

  if (params.q) {
    const rank = new Map(fuzzyRefs(params.q).map((ref, i) => [ref, i]));
    if (rank.size === 0) return empty;

    // Intersect the fuzzy hits with whatever the dropdown filters allow.
    const allowed = db.prepare(`SELECT ref FROM artworks ${where}`).all(args) as Array<{
      ref: string;
    }>;
    let matched = allowed.map((r) => r.ref).filter((ref) => rank.has(ref));
    if (matched.length === 0) return empty;

    if (params.sort) {
      const { placeholders, args: refArgs } = named(matched, "s");
      matched = (
        db
          .prepare(
            `SELECT ref FROM artworks WHERE ref IN (${placeholders}) ORDER BY ${orderBy} ${dir}`
          )
          .all(refArgs) as Array<{ ref: string }>
      ).map((r) => r.ref);
    } else {
      matched.sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
    }

    const total = matched.length;
    const pageRefs = matched.slice((page - 1) * limit, page * limit);
    if (pageRefs.length === 0) {
      return { ...empty, total, pages: Math.ceil(total / limit) || 1 };
    }

    const { placeholders, args: refArgs } = named(pageRefs, "p");
    const fetched = db
      .prepare(`SELECT * FROM artworks WHERE ref IN (${placeholders})`)
      .all(refArgs) as ArtworkRow[];
    const byRef = new Map(fetched.map((row) => [row.ref, row]));
    const rows = pageRefs.map((ref) => byRef.get(ref)).filter(Boolean) as ArtworkRow[];

    return { rows, total, page, limit, pages: Math.ceil(total / limit) || 1 };
  }

  const total = db
    .prepare(`SELECT COUNT(*) AS n FROM artworks ${where}`)
    .get(args) as { n: number };

  const rows = db
    .prepare(
      `SELECT * FROM artworks ${where} ORDER BY ${orderBy} ${dir} LIMIT @limit OFFSET @offset`
    )
    .all({ ...args, limit, offset: (page - 1) * limit }) as ArtworkRow[];

  return { rows, total: total.n, page, limit, pages: Math.ceil(total.n / limit) || 1 };
}

export function getArtwork(key: string): ArtworkRow | null {
  const db = getDb();
  const byRef = db.prepare("SELECT * FROM artworks WHERE ref = ?").get(key) as ArtworkRow | undefined;
  if (byRef) return byRef;
  // Registro is not unique (a few portfolios share one number), so fall back to the first.
  return (
    (db
      .prepare("SELECT * FROM artworks WHERE registro = ? ORDER BY id LIMIT 1")
      .get(key) as ArtworkRow) ?? null
  );
}

/** Every record filed under one registro number, in entry order. */
export function getArtworksByRegistro(registro: string): ArtworkRow[] {
  return getDb()
    .prepare("SELECT * FROM artworks WHERE registro = ? ORDER BY id")
    .all(registro) as ArtworkRow[];
}

/** Allocates a unique ref: the registro itself, then -2, -3 on collision. */
export function allocateRef(registro: string, taken: Set<string>): string {
  const base = registro.trim() || "sin-registro";
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
}

export function updateArtwork(key: string, patch: Record<string, unknown>) {
  const db = getDb();
  const current = getArtwork(key);
  if (!current) return null;

  const updates: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(patch)) {
    const field = FIELD_BY_KEY.get(key);
    if (!field || READONLY_KEYS.has(key)) continue;
    updates[key] = coerce(field, value);
  }
  if (Object.keys(updates).length === 0) return current;

  const merged = { ...current, ...updates };
  Object.assign(updates, derived(merged));

  const assignments = Object.keys(updates)
    .map((key) => `${key} = @${key}`)
    .join(", ");
  db.prepare(
    `UPDATE artworks SET ${assignments}, updated_at = datetime('now') WHERE ref = @ref`
  ).run({ ...updates, ref: current.ref });

  return getArtwork(current.ref);
}

/**
 * Next number in the collection's main series ("2531" -> "2532").
 *
 * A handful of rows sit in separate series (10000-10003, 100002-100006), so the
 * highest number overall would suggest 100007. Taking the most common width
 * instead keeps the suggestion inside the four-digit run that 2,459 works use.
 * Only a suggestion — the number stays editable and duplicates are allowed.
 */
export function nextRegistro(): string {
  const db = getDb();
  const numeric = `registro GLOB '[0-9]*' AND registro NOT GLOB '*[^0-9]*'`;

  const width = db
    .prepare(
      `SELECT LENGTH(registro) AS width, COUNT(*) AS n FROM artworks
        WHERE ${numeric} GROUP BY width ORDER BY n DESC, width DESC LIMIT 1`
    )
    .get() as { width: number } | undefined;
  if (!width) return "0001";

  const row = db
    .prepare(
      `SELECT registro FROM artworks
        WHERE ${numeric} AND LENGTH(registro) = @width
        ORDER BY CAST(registro AS INTEGER) DESC LIMIT 1`
    )
    .get({ width: width.width }) as { registro: string } | undefined;
  if (!row) return "0001";

  return String(Number(row.registro) + 1).padStart(row.registro.length, "0");
}

export function createArtwork(values: Record<string, unknown>) {
  const db = getDb();
  const registro = String(values.registro ?? "").trim();
  if (!registro) throw new Error("El # de registro es obligatorio");

  const row: Record<string, string | number | null> = {};
  for (const field of FIELDS) {
    row[field.key] = coerce(field, values[field.key]);
  }
  row.registro = registro;
  // A registro may legitimately repeat, so the row gets its own unique ref.
  const taken = new Set(
    (db.prepare("SELECT ref FROM artworks").all() as Array<{ ref: string }>).map((r) => r.ref)
  );
  row.ref = allocateRef(registro, taken);
  Object.assign(row, derived(row));

  const keys = Object.keys(row);
  db.prepare(
    `INSERT INTO artworks (${keys.join(", ")}) VALUES (${keys.map((k) => `@${k}`).join(", ")})`
  ).run(row);

  return getArtwork(String(row.ref));
}

export function deleteArtwork(key: string) {
  const current = getArtwork(key);
  if (!current) return false;
  return getDb().prepare("DELETE FROM artworks WHERE ref = ?").run(current.ref).changes > 0;
}

export function facets() {
  const db = getDb();
  const distinct = (column: string) =>
    (
      db
        .prepare(
          `SELECT ${column} AS value, COUNT(*) AS count FROM artworks
           WHERE ${column} IS NOT NULL AND ${column} != ''
           GROUP BY ${column} ORDER BY count DESC, value ASC`
        )
        .all() as Array<{ value: string; count: number }>
    ).filter((r) => r.value);

  return {
    artist: distinct("artist_last"),
    medium: distinct("medium"),
    technique: distinct("technique"),
    support: distinct("support"),
    location: distinct("location"),
    acquisitionMethod: distinct("acquisition_method"),
    birthPlace: distinct("artist_birth_place"),
    category: distinct("category"),
    statusGroup: distinct("status_group"),
  };
}

export type Facets = ReturnType<typeof facets>;

export function stats() {
  const db = getDb();
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN image_thumb IS NOT NULL THEN 1 ELSE 0 END) AS with_image,
              SUM(COALESCE(purchase_price, 0)) AS purchase_total,
              SUM(COALESCE(current_value, 0)) AS value_total,
              COUNT(DISTINCT artist_last || ' ' || COALESCE(artist_first, '')) AS artists,
              SUM(CASE WHEN ${FOR_SALE_SQL} THEN 1 ELSE 0 END) AS for_sale
       FROM artworks`
    )
    .get() as Record<string, number>;

  const byStatus = db
    .prepare(
      `SELECT status_group AS value, COUNT(*) AS count,
              SUM(COALESCE(current_value, 0)) AS value_total
       FROM artworks GROUP BY status_group ORDER BY count DESC`
    )
    .all() as Array<{ value: string; count: number; value_total: number }>;

  const topArtists = db
    .prepare(
      `SELECT artist_last, artist_first, COUNT(*) AS count,
              SUM(COALESCE(current_value, 0)) AS value_total
       FROM artworks GROUP BY artist_last, artist_first
       ORDER BY count DESC LIMIT 12`
    )
    .all() as Array<{ artist_last: string; artist_first: string; count: number; value_total: number }>;

  const byDecade = db
    .prepare(
      `SELECT (year / 10) * 10 AS decade, COUNT(*) AS count
       FROM artworks WHERE year IS NOT NULL AND year > 1800
       GROUP BY decade ORDER BY decade ASC`
    )
    .all() as Array<{ decade: number; count: number }>;

  const recent = db
    .prepare(
      `SELECT ref, registro, title, artist_last, artist_first, updated_at
       FROM artworks ORDER BY updated_at DESC LIMIT 8`
    )
    .all() as Array<Record<string, string>>;

  return { totals, byStatus, topArtists, byDecade, recent };
}

/** Fields that are blank across every row, plus rows missing key data. */
export function dataQuality() {
  const db = getDb();
  const total = (db.prepare("SELECT COUNT(*) AS n FROM artworks").get() as { n: number }).n;

  const emptyFields = FIELDS.filter((f) => f.key !== "registro")
    .map((f) => {
      const filled = (
        db
          .prepare(`SELECT COUNT(*) AS n FROM artworks WHERE ${f.key} IS NOT NULL AND ${f.key} != ''`)
          .get() as { n: number }
      ).n;
      return { key: f.key, label: f.label, filled, missing: total - filled };
    })
    .sort((a, b) => a.filled - b.filled);

  const missingImage = (
    db.prepare("SELECT COUNT(*) AS n FROM artworks WHERE image_thumb IS NULL").get() as { n: number }
  ).n;
  const missingValue = (
    db.prepare("SELECT COUNT(*) AS n FROM artworks WHERE current_value IS NULL").get() as { n: number }
  ).n;
  const missingLocation = (
    db
      .prepare("SELECT COUNT(*) AS n FROM artworks WHERE location IS NULL OR location = ''")
      .get() as { n: number }
  ).n;

  return { total, emptyFields, missingImage, missingValue, missingLocation };
}
