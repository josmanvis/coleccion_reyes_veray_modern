import { FIELDS, artistName, isForSale, titleCase } from "./fields";
import type { ArtworkRow } from "./db";

/** Shape the public site already consumes (see lib/mac.ts Artwork). */
export type WebsiteArtwork = {
  id: string;
  title: string;
  slug: string;
  url: string;
  images: string[];
  description: string;
  price: number | null;
  currency: string;
  tags: string[];
  /** Offered for sale — a leading "V" in the Ventas column. */
  forSale: boolean;
};

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function toWebsiteArtwork(row: ArtworkRow): WebsiteArtwork {
  const artist = artistName(row as { artist_first?: string; artist_last?: string });
  const title = titleCase(String(row.title || "Sin título"));
  const images = [
    ...new Set([row.image_full, row.image_thumb].filter((v): v is string => Boolean(v))),
  ];

  const description = [
    artist,
    row.technique ? titleCase(String(row.technique)) : null,
    row.support ? `sobre ${row.support}` : null,
    row.dimensions,
    row.year,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    id: String(row.registro),
    title,
    slug: row.website_slug ? String(row.website_slug) : `${slugify(artist)}-${row.registro}`,
    url: `/art/${row.website_slug ?? `${slugify(artist)}-${row.registro}`}`,
    images,
    description,
    price: typeof row.current_value === "number" ? row.current_value : null,
    currency: "USD",
    tags: [row.medium, row.technique, row.support]
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .map((v) => v.toLowerCase()),
    forSale: isForSale(row.sales),
  };
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: ArtworkRow[]): string {
  const columns = FIELDS.map((f) => f.key);
  const header = FIELDS.map((f) => csvCell(f.label)).join(",");
  const body = rows.map((row) => columns.map((key) => csvCell(row[key])).join(","));
  return [header, ...body].join("\n");
}
