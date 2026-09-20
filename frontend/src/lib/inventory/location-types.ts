/**
 * Shapes and parsing for physical storage locations.
 *
 * DB-free on purpose: the locations admin screen is a client component, and
 * importing anything that reaches better-sqlite3 breaks the browser bundle.
 *
 * Where each work is physically stored.
 *
 * The spreadsheet records this as free text — "480- Gaveta 05", "480 - gaveta 1",
 * "480-13-caja 16" — which is 269 spellings of maybe 60 real places. Rather than
 * replace that column (the spreadsheet stays the source of truth), this parses it
 * into a structured view and writes back a canonical string, so the same drawer is
 * always spelled the same way.
 *
 * The registry of buildings and units is editable, so new drawers, boxes, pigeon
 * holes or cabinets can be added in any building without a code change.
 */

import { normalizeText } from "./fields";

/** Container kinds. `otro` covers named places like "Almacén" or "Conference". */
export type UnitKind = "gaveta" | "caja" | "archivo" | "palomar" | "sala" | "otro";

export const UNIT_KINDS: UnitKind[] = ["gaveta", "caja", "archivo", "palomar", "sala", "otro"];

export const UNIT_LABELS: Record<UnitKind, string> = {
  gaveta: "Gaveta",
  caja: "Caja",
  archivo: "Archivo",
  palomar: "Palomar",
  sala: "Sala",
  otro: "Otro",
};

/** Plural forms for headings and counts. */
export const UNIT_LABELS_PLURAL: Record<UnitKind, string> = {
  gaveta: "Gavetas",
  caja: "Cajas",
  archivo: "Archivos",
  palomar: "Palomares",
  sala: "Salas",
  otro: "Otros",
};

export type ParsedLocation = {
  /** Building code, e.g. "480" or "482". */
  building: string | null;
  /** Room within the building, when the cell records one ("480-13-caja 16"). */
  room: string | null;
  kind: UnitKind | null;
  /** Unit number or name, normalised ("05" -> "5", "Almacén" kept as written). */
  label: string | null;
  /** True when nothing structured could be read out of the text. */
  unparsed: boolean;
  raw: string;
};

// The trailing (?![a-z]) rather than \b lets "caja11" match while "cajamarca"
// does not — the spreadsheet often omits the space before the number.
const KIND_WORDS: Array<{ kind: UnitKind; pattern: RegExp }> = [
  { kind: "gaveta", pattern: /\bgavetas?(?![a-z])/ },
  { kind: "caja", pattern: /\bcajas?(?![a-z])/ },
  { kind: "archivo", pattern: /\b(archivos?|file\s*cabinets?|files?)(?![a-z])/ },
  { kind: "palomar", pattern: /\b(palomar(es)?|pigeon\s*holes?)(?![a-z])/ },
  { kind: "sala", pattern: /\b(sala|salon|room|conference|almacen|oficina)(?![a-z])/ },
];

/** Drops leading zeros so "05" and "5" are the same drawer. */
function normalizeLabel(value: string): string {
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? String(Number(trimmed)) : trimmed;
}

/**
 * Reads one free-text cell. Deliberately forgiving: the separator may be "-",
 * ":" or nothing, and the number may precede or follow the container word.
 */
export function parseLocation(raw: string | null | undefined): ParsedLocation {
  const original = String(raw ?? "").trim();
  const empty: ParsedLocation = {
    building: null,
    room: null,
    kind: null,
    label: null,
    unparsed: true,
    raw: original,
  };
  if (!original) return empty;

  const text = normalizeText(original);

  const building = text.match(/\b(4\d{2})\b/)?.[1] ?? null;

  let kind: UnitKind | null = null;
  let kindAt = -1;
  for (const { kind: candidate, pattern } of KIND_WORDS) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      kind = candidate;
      kindAt = match.index;
      break;
    }
  }

  let label: string | null = null;
  if (kind === "sala") {
    // Named rooms ("Almacén", "Conference 2do piso") are identified by their
    // name, never by a number — reading one would fold them all together.
    label =
      original
        .replace(/^\s*4\d{2}\s*[-:]?\s*/, "")
        .replace(/\s+/g, " ")
        .trim() || null;
  } else if (kind && kindAt >= 0) {
    // "gaveta 05" and "14 gaveta" both occur; prefer the number after the word.
    const after = text
      .slice(kindAt)
      .match(/(?:gavetas?|cajas?|archivos?|files?|palomar(?:es)?|pigeon\s*holes?)\s*[:\-#]?\s*(\d{1,3}|[a-z])(?![a-z0-9])/);
    if (after) label = normalizeLabel(after[1]);
    if (!label) {
      // Look behind, but never mistake the building code for a unit number.
      const before = text.slice(0, kindAt).match(/(\d{1,3})\s*[-\s]*$/);
      if (before && before[1] !== building) label = normalizeLabel(before[1]);
    }
  }

  // A building plus leftover words is a named place — "480- Recepción",
  // "480- Taller 2". Without this they all collapse onto a bare "480" group,
  // and unifying that group would overwrite a dozen distinct rooms at once.
  if (!kind && building) {
    const rest = original
      .replace(/^\s*4\d{2}\s*/, "")
      .replace(/^[\s\-–:]+/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (rest && !/^\d{1,3}$/.test(rest) && !/^[?]+$/.test(rest)) {
      kind = "sala";
      label = rest;
    }
  }

  // "480-13-caja 16" and bare "480-3": the number after the building is a room.
  let room: string | null = null;
  if (building) {
    const roomMatch = text.match(new RegExp(`\\b${building}\\b\\s*[-–:]?\\s*(\\d{1,3})\\b`));
    if (roomMatch && normalizeLabel(roomMatch[1]) !== label) {
      room = normalizeLabel(roomMatch[1]);
    }
  }

  const unparsed = !building && !kind;
  return { building, room, kind, label, unparsed, raw: original };
}

/** The one spelling every cell for this place should use. */
export function formatLocation(parsed: {
  building?: string | null;
  room?: string | null;
  kind?: UnitKind | null;
  label?: string | null;
}): string {
  const parts: string[] = [];
  if (parsed.building) parts.push(parsed.building);
  if (parsed.room) parts.push(`Sala ${parsed.room}`);
  if (parsed.kind && parsed.label) {
    parts.push(
      parsed.kind === "sala" && !/^\d+$/.test(parsed.label)
        ? parsed.label
        : `${UNIT_LABELS[parsed.kind]} ${parsed.label}`
    );
  } else if (parsed.label) {
    parts.push(parsed.label);
  }
  return parts.join(" · ");
}

/** Stable identity for a place, used to group works and match the registry. */
export function locationKey(parsed: {
  building?: string | null;
  room?: string | null;
  kind?: UnitKind | null;
  label?: string | null;
}): string {
  return [
    parsed.building ?? "?",
    parsed.room ?? "",
    parsed.kind ?? "",
    parsed.label ? normalizeText(String(parsed.label)) : "",
  ].join("|");
}


export type Building = {
  id: number;
  code: string;
  name: string | null;
  notes: string | null;
};

export type StorageUnit = {
  id: number;
  building_id: number;
  building: string;
  kind: UnitKind;
  label: string;
  room: string | null;
  notes: string | null;
};

export type UnitUsage = {
  key: string;
  building: string | null;
  room: string | null;
  kind: UnitKind | null;
  label: string | null;
  /** Canonical spelling for this place. */
  canonical: string;
  count: number;
  /** Every raw spelling found in the data for this same place. */
  spellings: Array<{ raw: string; count: number }>;
};
