import type { ArtworkRow } from "@/lib/inventory/db";
import { artistName, isForSale, titleCase } from "@/lib/inventory/fields";

/**
 * The `data-*` attributes a server-rendered element carries so the context
 * menu knows what was right-clicked. Spread onto the row: `{...artworkCtx(row)}`.
 * Only the type comes from db.ts, so this stays safe for client bundles.
 */

type Attrs = Record<`data-${string}`, string>;

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/** A work, wherever it is listed. Sale and status items appear only when known. */
export function artworkCtx(row: Partial<ArtworkRow> & { ref: string; registro: string }): Attrs {
  const attrs: Attrs = {
    "data-ctx": "artwork",
    "data-ref": row.ref,
    "data-registro": row.registro,
    "data-title": row.title ? titleCase(String(row.title)) : "",
  };
  if ("artist_last" in row) {
    attrs["data-artist"] = artistName(row);
    attrs["data-artist-last"] = str(row.artist_last);
  }
  if ("location" in row) attrs["data-location"] = str(row.location);
  if ("sales" in row) {
    attrs["data-sales"] = str(row.sales);
    attrs["data-for-sale"] = isForSale(row.sales) ? "1" : "0";
  }
  if (row.status_group) attrs["data-deaccessed"] = row.status_group === "de_accessed" ? "1" : "0";
  const image = row.image_full || row.image_thumb;
  if (image) attrs["data-image"] = String(image);
  return attrs;
}

/** A value on a record, copied on its own; the menu then continues with the record's. */
export function fieldCtx(label: string, value: unknown): Attrs {
  return { "data-ctx": "field", "data-label": label, "data-value": str(value) };
}
