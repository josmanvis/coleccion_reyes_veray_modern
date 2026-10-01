/**
 * Market data behind the suggested prices. Server-only.
 *
 * An artist's sales come from three places:
 *   - `market_sales`: auction and gallery results someone recorded by hand;
 *   - the collection's own purchases (price and date from the spreadsheet);
 *   - the collection's own sales, read from «Estatus» ("Precio de venta $43,200
 *     … el 12 de abril de 2012").
 * Gifts and finds are not sales and are left out.
 *
 * Nothing here writes a price into a work: the suggestion is computed on every
 * read and sits next to the recorded «Valor actual», never over it.
 */

import { getDb } from "./db";
import { moveToTrash } from "./trash";
import type { Actor } from "./audit";
import { artistKey, artistSlugIndex } from "./public";
import { profilesBySlug } from "./artist-profile";
import { readSettings } from "./settings";
import { parseSpanishDate } from "./certificate-files";
import { artistName } from "./fields";
import {
  hotStatus,
  parseLooseDate,
  rulesFromSettings,
  valuate,
  type Comparable,
  type HotStatus,
  type Valuation,
  type ValuationRules,
  type WorkKind,
} from "./valuation-rules";

export * from "./valuation-rules";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS market_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artist_key TEXT NOT NULL,
  artist_name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  sale_date TEXT NOT NULL,
  price REAL NOT NULL,
  kind TEXT NOT NULL DEFAULT 'unica',
  venue TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_market_sales_artist ON market_sales(artist_key);

CREATE TABLE IF NOT EXISTS artist_market (
  artist_key TEXT PRIMARY KEY,
  hot TEXT NOT NULL DEFAULT 'auto',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

let ready = false;

function db() {
  const handle = getDb();
  if (!ready) {
    handle.exec(SCHEMA);
    ready = true;
  }
  return handle;
}

export type MarketSale = {
  id: number;
  artist_key: string;
  artist_name: string;
  title: string;
  sale_date: string;
  price: number;
  kind: WorkKind;
  venue: string;
  url: string;
  notes: string;
  created_at: string;
  created_by: string;
};

export type HotSetting = "auto" | "si" | "no";

// --- Recorded market sales ----------------------------------------------------

export function listMarketSales(key?: string): MarketSale[] {
  const sql = `SELECT * FROM market_sales ${key ? "WHERE artist_key = ?" : ""} ORDER BY sale_date DESC, id DESC`;
  return (key ? db().prepare(sql).all(key) : db().prepare(sql).all()) as MarketSale[];
}

export function addMarketSale(
  input: {
    artist_key: string;
    artist_name?: string;
    title?: string;
    sale_date: string;
    price: number | string;
    kind?: string;
    venue?: string;
    url?: string;
    notes?: string;
  },
  actor?: Actor | null
): MarketSale {
  const key = String(input.artist_key ?? "").trim();
  if (!key || key === "|") throw new Error("Falta el artista");
  const price = Number(String(input.price).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(price) || price <= 0) throw new Error("El precio debe ser mayor que cero");
  const date = parseLooseDate(input.sale_date);
  if (!date) throw new Error("Fecha inválida — usa AAAA, AAAA-MM o AAAA-MM-DD");
  const kind: WorkKind = input.kind === "edicion" ? "edicion" : "unica";

  const info = db()
    .prepare(
      `INSERT INTO market_sales (artist_key, artist_name, title, sale_date, price, kind, venue, url, notes, created_by)
       VALUES (@key, @name, @title, @date, @price, @kind, @venue, @url, @notes, @by)`
    )
    .run({
      key,
      name: String(input.artist_name ?? "").trim(),
      title: String(input.title ?? "").trim(),
      date,
      price,
      kind,
      venue: String(input.venue ?? "").trim(),
      url: String(input.url ?? "").trim(),
      notes: String(input.notes ?? "").trim(),
      by: actor?.name ?? "",
    });
  return db().prepare("SELECT * FROM market_sales WHERE id = ?").get(info.lastInsertRowid) as MarketSale;
}

export function deleteMarketSale(id: number, actor?: Actor | null): number | null {
  const sale = db().prepare("SELECT * FROM market_sales WHERE id = ?").get(id) as MarketSale | undefined;
  if (!sale) return null;
  return moveToTrash({
    entity: "venta",
    entityId: String(id),
    label: `${sale.artist_name || sale.artist_key} · $${sale.price.toLocaleString("en-US")}`,
    detail: [sale.title, sale.venue, sale.sale_date].filter(Boolean).join(" · "),
    rows: [{ table: "market_sales", where: "id = ?", args: [id] }],
    actor,
  });
}

export function setHot(key: string, hot: HotSetting) {
  if (!["auto", "si", "no"].includes(hot)) throw new Error("Valor inválido");
  db()
    .prepare(
      `INSERT INTO artist_market (artist_key, hot) VALUES (?, ?)
       ON CONFLICT(artist_key) DO UPDATE SET hot = excluded.hot, updated_at = datetime('now')`
    )
    .run(key, hot);
}

// --- Evidence from the collection's own records ----------------------------------

type WorkRow = {
  ref: number;
  registro: string;
  title: string | null;
  artist_last: string | null;
  artist_first: string | null;
  artist_death_year: string | null;
  edition: string | null;
  purchase_price: number | null;
  current_value: number | null;
  acquisition_date: string | null;
  acquisition_method: string | null;
  status: string | null;
  status_group: string | null;
  image_thumb: string | null;
};

/** "28/300", "P/A", "8/8" are editions; "1/1", "única" and blank are unique. */
export function workKind(edition: string | null): WorkKind {
  const text = String(edition ?? "").trim().toLowerCase();
  if (!text || text === "1/1" || /unica|única|unique/.test(text)) return "unica";
  return "edicion";
}

const NOT_A_SALE = /obsequi|regal|donaci|donad|encontrad|herencia|heredad|intercambi/i;

function purchaseOf(row: WorkRow): Comparable | null {
  const price = Number(row.purchase_price);
  const date = parseLooseDate(row.acquisition_date);
  if (!date || !Number.isFinite(price) || price <= 0) return null;
  if (NOT_A_SALE.test(String(row.acquisition_method ?? ""))) return null;
  return {
    price,
    date,
    kind: workKind(row.edition),
    source: "compra",
    venue: String(row.acquisition_method ?? ""),
    title: row.title,
    registro: row.registro,
  };
}

function saleOf(row: WorkRow): Comparable | null {
  const status = String(row.status ?? "");
  const price = status.match(/precio de venta:?\s*\$\s*([\d,]+(?:\.\d+)?)/i)?.[1];
  if (!price) return null;
  const date = parseSpanishDate(status) ?? parseLooseDate(status.match(/\b(19|20)\d{2}\b/)?.[0]);
  if (!date) return null;
  return {
    price: Number(price.replace(/,/g, "")),
    date,
    kind: workKind(row.edition),
    source: "venta",
    venue: status.match(/vendid[ao] (?:a|al) ([^.]+?)(?: el |\.|$)/i)?.[1] ?? "",
    title: row.title,
    registro: row.registro,
  };
}

// --- Putting it together --------------------------------------------------------

export type ArtistMarket = {
  key: string;
  name: string;
  slug: string | null;
  deathYear: number | null;
  famous: boolean;
  hotSetting: HotSetting;
  hot: HotStatus;
  /** Every sale, newest first. */
  sales: Comparable[];
};

export type WorkValuation = Valuation & {
  ref: number;
  registro: string;
  title: string | null;
  thumb: string | null;
  artistKey: string;
  artistName: string;
  artistSlug: string | null;
  kind: WorkKind;
  recorded: number | null;
  purchase: number | null;
  inCollection: boolean;
  hot: boolean;
};

type Context = {
  rules: ValuationRules;
  rows: WorkRow[];
  artists: Map<string, ArtistMarket>;
};

function deathYearOf(profileDate: string | undefined, rows: WorkRow[]): number | null {
  const fromProfile = Number(String(profileDate ?? "").slice(0, 4));
  if (fromProfile > 1000) return fromProfile;
  const years = rows.map((r) => Number(r.artist_death_year)).filter((y) => y > 1000);
  return years.length ? Math.max(...years) : null;
}

function buildContext(today: Date): Context {
  const settings = readSettings() as Record<string, string>;
  const rules = rulesFromSettings((key) => settings[key]);
  const rows = getDb()
    .prepare(
      `SELECT ref, registro, title, artist_last, artist_first, artist_death_year, edition, purchase_price,
              current_value, acquisition_date, acquisition_method, status, status_group, image_thumb
         FROM artworks`
    )
    .all() as WorkRow[];

  const manual = new Map(
    (db().prepare("SELECT artist_key, hot FROM artist_market").all() as Array<{ artist_key: string; hot: HotSetting }>).map(
      (r) => [r.artist_key, r.hot]
    )
  );
  const recorded = new Map<string, Comparable[]>();
  for (const sale of listMarketSales()) {
    if (!recorded.has(sale.artist_key)) recorded.set(sale.artist_key, []);
    recorded.get(sale.artist_key)!.push({
      id: sale.id,
      price: sale.price,
      date: sale.sale_date,
      kind: sale.kind,
      source: "mercado",
      venue: sale.venue,
      title: sale.title,
    });
  }

  const slugs = artistSlugIndex();
  const profiles = profilesBySlug();
  const byArtist = new Map<string, WorkRow[]>();
  for (const row of rows) {
    const key = artistKey(row);
    if (key === "|") continue;
    if (!byArtist.has(key)) byArtist.set(key, []);
    byArtist.get(key)!.push(row);
  }

  const artists = new Map<string, ArtistMarket>();
  const keys = new Set([...byArtist.keys(), ...recorded.keys()]);
  for (const key of keys) {
    const works = byArtist.get(key) ?? [];
    const slug = slugs.get(key) ?? null;
    const profile = slug ? profiles.get(slug) : undefined;
    const sales = [
      ...(recorded.get(key) ?? []),
      ...works.flatMap((w) => [purchaseOf(w), saleOf(w)].filter((s): s is Comparable => s !== null)),
    ].sort((a, b) => b.date.localeCompare(a.date));
    const famous = Boolean(profile?.wiki);
    const hotSetting = manual.get(key) ?? "auto";
    artists.set(key, {
      key,
      name: works[0] ? artistName(works[0] as unknown as Record<string, unknown>) : key,
      slug,
      deathYear: deathYearOf(profile?.death_date, works),
      famous,
      hotSetting,
      hot: hotStatus(sales, hotSetting, famous, rules, today),
      sales,
    });
  }
  return { rules, rows, artists };
}

function valuateRow(row: WorkRow, context: Context, today: Date): WorkValuation {
  const key = artistKey(row);
  const artist = context.artists.get(key);
  const kind = workKind(row.edition);
  const result = valuate({
    work: {
      registro: row.registro,
      kind,
      purchasePrice: row.purchase_price,
      acquisitionDate: row.acquisition_date,
      currentValue: row.current_value,
    },
    sales: artist?.sales ?? [],
    deathYear: artist?.deathYear ?? null,
    hot: artist?.hot ?? { hot: false, by: null, marketSales3y: 0, growth: null, famous: false },
    rules: context.rules,
    today,
  });
  return {
    ...result,
    ref: row.ref,
    registro: row.registro,
    title: row.title,
    thumb: row.image_thumb,
    artistKey: key,
    artistName: artist?.name ?? artistName(row as unknown as Record<string, unknown>),
    artistSlug: artist?.slug ?? null,
    kind,
    recorded: row.current_value,
    purchase: row.purchase_price,
    inCollection: row.status_group !== "de_accessed",
    hot: artist?.hot.hot ?? false,
  };
}

export function valuationForRef(ref: string | number): { valuation: WorkValuation; artist: ArtistMarket | null; rules: ValuationRules } | null {
  const today = new Date();
  const context = buildContext(today);
  const row = context.rows.find((r) => String(r.ref) === String(ref));
  if (!row) return null;
  return {
    valuation: valuateRow(row, context, today),
    artist: context.artists.get(artistKey(row)) ?? null,
    rules: context.rules,
  };
}

export function allValuations(): { valuations: WorkValuation[]; rules: ValuationRules } {
  const today = new Date();
  const context = buildContext(today);
  return { valuations: context.rows.map((row) => valuateRow(row, context, today)), rules: context.rules };
}

export function artistMarket(key: string): { artist: ArtistMarket | null; recorded: MarketSale[]; rules: ValuationRules } {
  const context = buildContext(new Date());
  return { artist: context.artists.get(key) ?? null, recorded: listMarketSales(key), rules: context.rules };
}
