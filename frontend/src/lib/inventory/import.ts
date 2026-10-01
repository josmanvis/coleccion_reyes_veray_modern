import ExcelJS from "exceljs";
import fs from "node:fs/promises";
import path from "node:path";
import { FIELDS, cleanCell } from "./fields";
import { getDb, coerce, derived, allocateRef } from "./db";

export type ImportResult = {
  inserted: number;
  updated: number;
  skipped: number;
  unknownColumns: string[];
  missingColumns: string[];
  errors: string[];
};

/** ExcelJS hands back rich text, formula and hyperlink objects as well as primitives. */
function cellText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return String(value.getUTCFullYear());
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.richText)) {
      return cleanCell((v.richText as Array<{ text: string }>).map((t) => t.text).join(""));
    }
    if ("result" in v) return cellText(v.result);
    if ("text" in v) return cellText(v.text);
    if ("hyperlink" in v) return cleanCell(v.hyperlink);
    return null;
  }
  return cleanCell(value);
}

/**
 * Upserts every row of the spreadsheet keyed on "# Registro". Existing records
 * keep their id (and therefore their linked images) and only get new values.
 */
export async function importWorkbook(buffer: ArrayBuffer | Buffer): Promise<ImportResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as ArrayBuffer);

  const sheet = workbook.worksheets[0];
  const result: ImportResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    unknownColumns: [],
    missingColumns: [],
    errors: [],
  };
  if (!sheet) {
    result.errors.push("El archivo no contiene ninguna hoja de cálculo.");
    return result;
  }

  const headerRow = sheet.getRow(1);
  const columnToKey = new Map<number, string>();
  const seenColumns = new Set<string>();
  const byColumn = new Map(FIELDS.map((f) => [f.column.trim().toLowerCase(), f.key]));

  headerRow.eachCell((cell, colNumber) => {
    const header = cellText(cell.value);
    if (!header) return;
    const key = byColumn.get(header.trim().toLowerCase());
    if (key) {
      columnToKey.set(colNumber, key);
      seenColumns.add(key);
    } else if (!/^Field \d+$/i.test(header)) {
      result.unknownColumns.push(header);
    }
  });

  if (!seenColumns.has("registro")) {
    result.errors.push('No se encontró la columna "# Registro"; no se importó nada.');
    return result;
  }
  result.missingColumns = FIELDS.filter((f) => !seenColumns.has(f.key)).map((f) => f.label);

  const db = getDb();
  const existing = new Set(
    (db.prepare("SELECT ref FROM artworks").all() as Array<{ ref: string }>).map((r) => r.ref)
  );

  const keys = FIELDS.map((f) => f.key);
  const insert = db.prepare(
    `INSERT INTO artworks (ref, ${keys.join(", ")}, status_group, search_blob, raw_json)
     VALUES (@ref, ${keys.map((k) => `@${k}`).join(", ")}, @status_group, @search_blob, @raw_json)`
  );
  const update = db.prepare(
    `UPDATE artworks SET ${keys
      .map((k) => `${k} = @${k}`)
      .join(", ")}, status_group = @status_group, search_blob = @search_blob,
       raw_json = @raw_json, updated_at = datetime('now')
     WHERE ref = @ref`
  );

  // A registro can repeat across rows, so refs are allocated in file order:
  // the first "0125" keeps that ref, the next becomes "0125-2".
  const refsUsed = new Set<string>();

  const run = db.transaction(() => {
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const raw: Record<string, string | null> = {};
      const values: Record<string, string | number | null> = {};
      for (const [colNumber, key] of columnToKey) {
        const text = cellText(row.getCell(colNumber).value);
        raw[key] = text;
      }
      for (const field of FIELDS) {
        values[field.key] = coerce(field, raw[field.key] ?? null);
      }

      const registro = raw.registro?.trim() ?? "";
      const hasContent = Object.entries(raw).some(
        ([key, value]) => key !== "registro" && value !== null && value !== ""
      );
      if (!registro && !hasContent) {
        result.skipped += 1;
        return;
      }
      values.registro = registro || null;

      const ref = allocateRef(registro, refsUsed);
      const record = { ...values, ref, ...derived(values), raw_json: JSON.stringify(raw) };
      try {
        if (existing.has(ref)) {
          update.run(record);
          result.updated += 1;
        } else {
          insert.run(record);
          existing.add(ref);
          result.inserted += 1;
        }
      } catch (error) {
        result.errors.push(`Fila ${rowNumber} (registro ${registro || "—"}): ${(error as Error).message}`);
      }
    });
  });
  run();

  return result;
}

type WebsiteEntry = {
  title?: string;
  url?: string;
  description?: string;
  images?: string[];
  ut_thumb?: string;
  ut_high?: string;
};

const WP_ORIGIN_CDN = "https://i0.wp.com/coleccionreyesveray.com";

function toCdnUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.startsWith("/wp-content/")) return path;
  return `${WP_ORIGIN_CDN}${path}?ssl=1`;
}

/**
 * Canonical form of a registro for matching, e.g. "0012.a", "0012a" and
 * "0012-i" all reduce to "12a"/"12i". Portfolio sheets carry a letter suffix
 * that has to survive: dropping it made every sheet collide with its portfolio.
 */
export function registroKey(value: string): string | null {
  const match = String(value)
    .trim()
    .match(/^(\d{1,6})\s*[.\-]?\s*([a-z]{1,3})?/i);
  if (!match) return null;
  const digits = match[1].replace(/^0+/, "") || "0";
  return digits + (match[2] ? match[2].toLowerCase() : "");
}

/** Pulls the CRV number out of a scraped page title or description. */
function registroOf(entry: WebsiteEntry): string | null {
  const haystack = `${entry.description ?? ""} | ${entry.title ?? ""}`;
  // "CRV #0012a", "CRV 0012b" and a bare "#1476" all appear in the scrape.
  const tagged = haystack.match(/CRV\s*#?\s*(\d{1,5}[.\-]?[a-z]{0,3})/i)
    ?? haystack.match(/#\s*(\d{1,5}[.\-]?[a-z]{0,3})/i);
  if (tagged) return registroKey(tagged[1]);
  const titled = (entry.title ?? "").match(/\.\s*(\d{3,5}[.\-]?[a-z]{0,3})\s*[–-]/);
  if (titled) return registroKey(titled[1]);
  return null;
}

/**
 * Attaches the public website's images to inventory records by matching the
 * registro number embedded in each scraped page.
 */
export async function linkWebsiteImages(): Promise<{ linked: number; unmatched: number }> {
  const file = path.join(process.cwd(), "src", "data", "artworks.json");
  const entries = JSON.parse(await fs.readFile(file, "utf8")) as WebsiteEntry[];

  const byRegistro = new Map<string, WebsiteEntry>();
  for (const entry of entries) {
    const registro = registroOf(entry);
    if (!registro) continue;
    const current = byRegistro.get(registro);
    // Prefer entries that already carry hosted images.
    if (!current || (!current.ut_thumb && entry.ut_thumb)) byRegistro.set(registro, entry);
  }

  const db = getDb();
  const rows = db.prepare("SELECT id, registro FROM artworks").all() as Array<{
    id: number;
    registro: string | null;
  }>;
  const update = db.prepare(
    "UPDATE artworks SET image_thumb = @thumb, image_full = @full, website_slug = @slug WHERE id = @id"
  );

  let linked = 0;
  const run = db.transaction(() => {
    for (const row of rows) {
      const registro = (row.registro ?? "").trim();
      if (!registro) continue;
      const key = registroKey(registro);
      const entry = key ? byRegistro.get(key) : undefined;
      if (!entry) continue;
      const fallback = entry.images?.[0] ? toCdnUrl(entry.images[0]) : null;
      const thumb = entry.ut_thumb || fallback;
      const full = entry.ut_high || fallback;
      if (!thumb && !full) continue;
      update.run({
        id: row.id,
        thumb,
        full,
        slug: (entry.url || "").replace(/^\//, "").replace(/\/index\.html$/, "") || null,
      });
      linked += 1;
    }
  });
  run();

  return { linked, unmatched: rows.length - linked };
}

// --- Parsing without writing -------------------------------------------------

export type ParsedRow = {
  /** Same ref allocation the importer uses, so a diff lines up with the record. */
  ref: string;
  registro: string;
  values: Record<string, string | number | null>;
  raw: Record<string, string | null>;
};

export type ParsedWorkbook = {
  rows: ParsedRow[];
  unknownColumns: string[];
  missingColumns: string[];
  skipped: number;
  errors: string[];
};

/**
 * Reads the spreadsheet into memory without touching the database, so an
 * import can be reviewed record by record before anything is written.
 */
export async function parseWorkbook(buffer: ArrayBuffer | Buffer): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as ArrayBuffer);

  const out: ParsedWorkbook = {
    rows: [],
    unknownColumns: [],
    missingColumns: [],
    skipped: 0,
    errors: [],
  };

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    out.errors.push("El archivo no contiene ninguna hoja de cálculo.");
    return out;
  }

  const columnToKey = new Map<number, string>();
  const seen = new Set<string>();
  const byColumn = new Map(FIELDS.map((f) => [f.column.trim().toLowerCase(), f.key]));

  sheet.getRow(1).eachCell((cell, colNumber) => {
    const header = cellText(cell.value);
    if (!header) return;
    const key = byColumn.get(header.trim().toLowerCase());
    if (key) {
      columnToKey.set(colNumber, key);
      seen.add(key);
    } else if (!/^Field \d+$/i.test(header)) {
      out.unknownColumns.push(header);
    }
  });

  if (!seen.has("registro")) {
    out.errors.push('No se encontró la columna "# Registro"; no se puede comparar.');
    return out;
  }
  out.missingColumns = FIELDS.filter((f) => !seen.has(f.key)).map((f) => f.label);

  const refsUsed = new Set<string>();
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const raw: Record<string, string | null> = {};
    for (const [colNumber, key] of columnToKey) {
      raw[key] = cellText(row.getCell(colNumber).value);
    }
    const values: Record<string, string | number | null> = {};
    for (const field of FIELDS) {
      values[field.key] = coerce(field, raw[field.key] ?? null);
    }

    const registro = raw.registro?.trim() ?? "";
    const hasContent = Object.entries(raw).some(
      ([key, value]) => key !== "registro" && value !== null && value !== ""
    );
    if (!registro && !hasContent) {
      out.skipped += 1;
      return;
    }
    values.registro = registro || null;

    out.rows.push({ ref: allocateRef(registro, refsUsed), registro, values, raw });
  });

  return out;
}
