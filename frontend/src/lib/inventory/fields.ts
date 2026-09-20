/**
 * Single source of truth for the inventory data model.
 * The SQLite schema, the spreadsheet importer, the table columns and the edit
 * form are all generated from this list, so a field is added in exactly one place.
 */

export type FieldType = "text" | "longtext" | "int" | "money";

export type FieldGroup =
  | "obra"
  | "artista"
  | "adquisicion"
  | "estado"
  | "historia"
  | "otros";

export type Field = {
  /** Database column and API key. */
  key: string;
  /** Spanish label shown in the UI. */
  label: string;
  /** Exact header text in the source spreadsheet. */
  column: string;
  type: FieldType;
  group: FieldGroup;
  /** Offered as a dropdown filter on /inventory. */
  facet?: boolean;
  /** Included in the free-text search blob. */
  search?: boolean;
};

export const GROUP_LABELS: Record<FieldGroup, string> = {
  obra: "La obra",
  artista: "El artista",
  adquisicion: "Adquisición",
  estado: "Estado y ubicación",
  historia: "Historial",
  otros: "Otros campos",
};

export const FIELDS: Field[] = [
  // --- La obra ---
  { key: "registro", label: "# Registro", column: "# Registro", type: "text", group: "obra", search: true },
  { key: "title", label: "Título", column: "Título", type: "text", group: "obra", search: true },
  { key: "year", label: "Año", column: "Año", type: "int", group: "obra" },
  { key: "medium", label: "Medio", column: "Medio", type: "text", group: "obra", facet: true },
  { key: "technique", label: "Técnica", column: "Técnica", type: "text", group: "obra", facet: true, search: true },
  { key: "support", label: "Soporte", column: "Soporte", type: "text", group: "obra", facet: true, search: true },
  { key: "dimensions", label: "Dimensiones", column: "Dimensiones", type: "text", group: "obra" },
  { key: "edition", label: "Edición", column: "Edición", type: "text", group: "obra" },
  { key: "signature", label: "Firma", column: "Firma", type: "text", group: "obra" },
  { key: "category", label: "Categoría", column: "Categoria", type: "text", group: "obra", facet: true },
  { key: "abstraccion", label: "Abstracción", column: "Abstraccion", type: "text", group: "obra" },

  // --- El artista ---
  { key: "artist_last", label: "Apellido artista", column: "Apellido artista", type: "text", group: "artista", search: true },
  { key: "artist_first", label: "Nombre artista", column: "Nombre artista", type: "text", group: "artista", search: true },
  { key: "artist_alias", label: "Nombre artístico", column: "Nombre artistíco", type: "text", group: "artista", search: true },
  { key: "artist_birth_year", label: "Año de nacimiento", column: "Año de Nacimiento", type: "int", group: "artista" },
  { key: "artist_death_year", label: "Año de defunción", column: "Año de defunción", type: "int", group: "artista" },
  { key: "artist_birth_place", label: "Lugar de nacimiento", column: "Lugar de Nacimiento", type: "text", group: "artista", facet: true, search: true },
  { key: "artist_death_place", label: "Lugar de defunción", column: "Lugar de defunción", type: "text", group: "artista" },
  { key: "biography", label: "Biografía", column: "Biografía", type: "longtext", group: "artista", search: true },
  { key: "artist_database", label: "Artist Database", column: "Artist Database", type: "text", group: "artista" },

  // --- Adquisición ---
  { key: "acquisition_date", label: "Fecha de adquisición", column: "Fecha de adquisición", type: "text", group: "adquisicion" },
  { key: "acquisition_method", label: "Método de adquisición", column: "Método de Adquisición", type: "text", group: "adquisicion", facet: true, search: true },
  { key: "purchase_price", label: "Precio de compra", column: "Precio de compra", type: "money", group: "adquisicion" },
  { key: "current_value", label: "Valor actual", column: "Valor Actual", type: "money", group: "adquisicion" },
  { key: "payment_detail", label: "Detalle de pago", column: "Detalle Pago", type: "text", group: "adquisicion" },
  { key: "deposito", label: "Depósito", column: "Deposito", type: "text", group: "adquisicion" },

  // --- Estado y ubicación ---
  { key: "status", label: "Estatus actual", column: "Estatus actual", type: "text", group: "estado", search: true },
  { key: "location", label: "Localización", column: "Localización", type: "text", group: "estado", facet: true, search: true },
  { key: "certificate", label: "Certificado de autenticidad", column: "Certificado de Autenticidad", type: "text", group: "estado" },
  { key: "restorations", label: "Restauraciones", column: "Restauraciones", type: "longtext", group: "estado" },
  { key: "insurance", label: "Seguro", column: "Seguro", type: "text", group: "estado" },
  { key: "casa", label: "Casa", column: "Casa", type: "text", group: "estado" },
  { key: "oficina", label: "Oficina", column: "Oficina", type: "text", group: "estado" },

  // --- Historial ---
  { key: "exhibition_history", label: "Historial de exhibiciones", column: "Historial de Exhibiciones", type: "longtext", group: "historia", search: true },
  { key: "publication_history", label: "Historial de publicaciones", column: "Historial de Publicaciones", type: "longtext", group: "historia", search: true },
  { key: "notes", label: "Notas adicionales", column: "Notas Adicionales", type: "longtext", group: "historia", search: true },

  // --- Otros campos del archivo original ---
  { key: "clave", label: "Clave", column: "Clave", type: "text", group: "otros" },
  { key: "conteo", label: "Conteo", column: "Conteo", type: "text", group: "otros" },
  { key: "da", label: "DA", column: "DA", type: "text", group: "otros" },
  { key: "erv", label: "ERV", column: "ERV", type: "text", group: "otros" },
  { key: "mb", label: "MB", column: "MB", type: "text", group: "otros" },
  { key: "ck2", label: "Ck2", column: "Ck2", type: "text", group: "otros" },
  { key: "subtotals", label: "Sub totales", column: "Sub Totales", type: "text", group: "otros" },
  { key: "tania", label: "Tania", column: "Tania", type: "text", group: "otros" },
  { key: "sales", label: "Ventas", column: "Ventas", type: "text", group: "otros" },
  { key: "valor", label: "Valor", column: "Valor", type: "text", group: "otros" },
];

export const FIELD_BY_KEY = new Map(FIELDS.map((f) => [f.key, f]));

/** Columns the UI never lets you edit — they are derived or managed by the system. */
export const READONLY_KEYS = new Set(["registro"]);

/** Normalized status buckets, derived from the free-text "Estatus actual". */
export const STATUS_GROUPS = {
  en_inventario: "En inventario",
  de_accessed: "De-accessed",
  otro: "Otro",
  sin_estatus: "Sin estatus",
} as const;

export type StatusGroup = keyof typeof STATUS_GROUPS;

export function statusGroupOf(status: string | null | undefined): StatusGroup {
  const s = (status || "").trim().toLowerCase();
  if (!s || s === "-") return "sin_estatus";
  if (s.startsWith("de-accessed") || s.startsWith("deaccessed")) return "de_accessed";
  if (s.includes("inventario")) return "en_inventario";
  return "otro";
}

/** Strips accents and lowercases so "Bogotá" matches a search for "bogota". */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Prices arrive as "1600", "$1,200.", "3- $5,000 c/u" or "-". Pull the first
 * number out so totals and sorting work; the untouched original stays in raw_json.
 */
export function parseMoney(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const match = value.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

export function parseInteger(value: unknown): number | null {
  if (typeof value === "number") return Number.isInteger(value) ? value : Math.trunc(value);
  if (typeof value !== "string") return null;
  const match = value.match(/\d{1,4}/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

export function cleanCell(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s || s === "-") return null;
  return s;
}

/** "acosta vélez" + "javier" -> "Javier Acosta Vélez" */
export function artistName(row: Record<string, unknown>): string {
  const first = titleCase(String(row.artist_first ?? ""));
  const last = titleCase(String(row.artist_last ?? ""));
  return [first, last].filter(Boolean).join(" ") || "Sin artista";
}

export function formatMoney(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function formatNumber(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0";
  return value.toLocaleString("en-US");
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// --- En venta ----------------------------------------------------------------

/**
 * "Ventas" is a free-text column the collection has used for years, holding a
 * short code and sometimes a note. Only "V1" marks a work as offered for sale
 * on the public site — a bare "V" means something else, as do "B", "R", "?" and
 * the buyer names that appear in a handful of cells.
 */
export const FOR_SALE_CODE = "V1";

/** The leading code in a Ventas cell: V, V1, v?, and so on. */
const SALES_CODE = /^\s*v\d*\??\s*/i;

export function isForSale(sales: unknown): boolean {
  return /^\s*v1\b/i.test(String(sales ?? ""));
}

/** Whatever the cell holds once the leading code is removed. */
function salesRemainder(sales: unknown): string {
  return String(sales ?? "")
    .replace(SALES_CODE, "")
    .trim();
}

/**
 * Sets or clears the for-sale code without discarding anything else in the
 * cell, so a buyer's name survives a toggle: "SOBRINO" -> "V1 SOBRINO" -> back.
 */
export function withForSale(sales: unknown, forSale: boolean): string | null {
  const rest = salesRemainder(sales);
  if (forSale) return rest ? `${FOR_SALE_CODE} ${rest}` : FOR_SALE_CODE;
  return rest || null;
}

// --- De-accession ------------------------------------------------------------

export const IN_INVENTORY_STATUS = "En inventario";
export const DEACCESSED_STATUS = "De-accessed";

/**
 * Keeps the shape the spreadsheet already uses ("De-accessed: vendida a …"),
 * so `statusGroupOf` still buckets it and the text stays readable.
 */
export function deaccessionStatus(note?: string | null): string {
  const trimmed = (note ?? "").trim();
  return trimmed ? `${DEACCESSED_STATUS}: ${trimmed}` : DEACCESSED_STATUS;
}

/**
 * Titles are typed in lowercase in the spreadsheet ("y tu abuela ¿donde esta?").
 * Title-casing a Spanish sentence reads wrong, so only lift the first letter and
 * leave everything else — including proper nouns already cased — untouched.
 */
export function sentenceCase(value: string): string {
  const trimmed = value.trim();
  // Only a leading letter is lifted. Titles that open with a number keep their
  // wording: "1873-1973 (del portafolio Esclavitud)" must not become "(Del …".
  if (!/^\p{L}/u.test(trimmed)) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
