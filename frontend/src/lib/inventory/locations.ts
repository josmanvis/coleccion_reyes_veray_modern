/**
 * Registry and usage queries for storage locations. Server-only — the shapes and
 * the free-text parser live in ./location-types so client code can use them.
 */

import { getDb } from "./db";
import {
  UNIT_KINDS,
  formatLocation,
  locationKey,
  parseLocation,
  type Building,
  type StorageUnit,
  type UnitKind,
  type UnitUsage,
} from "./location-types";

export * from "./location-types";

// --- Registry ----------------------------------------------------------------



const SCHEMA = `
CREATE TABLE IF NOT EXISTS buildings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS storage_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  room TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(building_id, kind, label, room)
);
CREATE INDEX IF NOT EXISTS idx_units_building ON storage_units(building_id);
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

export function listBuildings(): Building[] {
  return db().prepare("SELECT * FROM buildings ORDER BY code").all() as Building[];
}

export function createBuilding(code: string, name?: string | null): Building {
  const trimmed = code.trim();
  if (!trimmed) throw new Error("El edificio necesita un código");
  const existing = db().prepare("SELECT * FROM buildings WHERE code = ?").get(trimmed) as
    | Building
    | undefined;
  if (existing) throw new Error(`Ya existe el edificio "${trimmed}"`);

  db()
    .prepare("INSERT INTO buildings (code, name) VALUES (?, ?)")
    .run(trimmed, name?.trim() || null);
  return db().prepare("SELECT * FROM buildings WHERE code = ?").get(trimmed) as Building;
}

export function updateBuilding(id: number, patch: { code?: string; name?: string | null; notes?: string | null }) {
  const sets: string[] = [];
  const args: Record<string, unknown> = { id };
  if (patch.code !== undefined) {
    if (!patch.code.trim()) throw new Error("El código no puede quedar vacío");
    sets.push("code = @code");
    args.code = patch.code.trim();
  }
  if (patch.name !== undefined) {
    sets.push("name = @name");
    args.name = patch.name?.trim() || null;
  }
  if (patch.notes !== undefined) {
    sets.push("notes = @notes");
    args.notes = patch.notes?.trim() || null;
  }
  if (sets.length === 0) return;
  db().prepare(`UPDATE buildings SET ${sets.join(", ")} WHERE id = @id`).run(args);
}

export function deleteBuilding(id: number): boolean {
  return db().prepare("DELETE FROM buildings WHERE id = ?").run(id).changes > 0;
}

export function listUnits(): StorageUnit[] {
  return db()
    .prepare(
      `SELECT u.*, b.code AS building FROM storage_units u
         JOIN buildings b ON b.id = u.building_id
        ORDER BY b.code, u.kind, CAST(u.label AS INTEGER), u.label`
    )
    .all() as StorageUnit[];
}

export function createUnit(input: {
  building_id: number;
  kind: UnitKind;
  label: string;
  room?: string | null;
  notes?: string | null;
}): StorageUnit {
  const label = String(input.label ?? "").trim();
  if (!label) throw new Error("La unidad necesita un número o nombre");
  if (!UNIT_KINDS.includes(input.kind)) throw new Error("Tipo de unidad inválido");

  try {
    db()
      .prepare(
        "INSERT INTO storage_units (building_id, kind, label, room, notes) VALUES (@building_id, @kind, @label, @room, @notes)"
      )
      .run({
        building_id: input.building_id,
        kind: input.kind,
        label,
        room: input.room?.trim() || null,
        notes: input.notes?.trim() || null,
      });
  } catch (error) {
    if (String((error as Error).message).includes("UNIQUE")) {
      throw new Error("Esa unidad ya existe en este edificio");
    }
    throw error;
  }

  return listUnits().find(
    (u) => u.building_id === input.building_id && u.kind === input.kind && u.label === label
  )!;
}

export function updateUnit(
  id: number,
  patch: { kind?: UnitKind; label?: string; room?: string | null; notes?: string | null }
) {
  const sets: string[] = [];
  const args: Record<string, unknown> = { id };
  if (patch.kind !== undefined) {
    if (!UNIT_KINDS.includes(patch.kind)) throw new Error("Tipo de unidad inválido");
    sets.push("kind = @kind");
    args.kind = patch.kind;
  }
  if (patch.label !== undefined) {
    if (!patch.label.trim()) throw new Error("El número no puede quedar vacío");
    sets.push("label = @label");
    args.label = patch.label.trim();
  }
  if (patch.room !== undefined) {
    sets.push("room = @room");
    args.room = patch.room?.trim() || null;
  }
  if (patch.notes !== undefined) {
    sets.push("notes = @notes");
    args.notes = patch.notes?.trim() || null;
  }
  if (sets.length === 0) return;
  db().prepare(`UPDATE storage_units SET ${sets.join(", ")} WHERE id = @id`).run(args);
}

export function deleteUnit(id: number): boolean {
  return db().prepare("DELETE FROM storage_units WHERE id = ?").run(id).changes > 0;
}

// --- What is actually stored where -------------------------------------------


/** Groups the collection by the place each work says it is in. */
export function locationUsage(): { units: UnitUsage[]; unparsed: UnitUsage[]; withoutLocation: number } {
  const rows = getDb()
    .prepare(
      `SELECT location, COUNT(*) AS n FROM artworks
        WHERE location IS NOT NULL AND TRIM(location) != ''
        GROUP BY location`
    )
    .all() as Array<{ location: string; n: number }>;

  const groups = new Map<string, UnitUsage>();
  for (const row of rows) {
    const parsed = parseLocation(row.location);
    const key = locationKey(parsed);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        building: parsed.building,
        room: parsed.room,
        kind: parsed.kind,
        label: parsed.label,
        canonical: parsed.unparsed ? parsed.raw : formatLocation(parsed),
        count: 0,
        spellings: [],
      };
      groups.set(key, group);
    }
    group.count += row.n;
    group.spellings.push({ raw: row.location, count: row.n });
  }

  const all = [...groups.values()].map((g) => ({
    ...g,
    spellings: g.spellings.sort((a, b) => b.count - a.count),
  }));

  const withoutLocation = (
    getDb()
      .prepare("SELECT COUNT(*) n FROM artworks WHERE location IS NULL OR TRIM(location) = ''")
      .get() as { n: number }
  ).n;

  const sorter = (a: UnitUsage, b: UnitUsage) =>
    (a.building ?? "").localeCompare(b.building ?? "") ||
    (a.kind ?? "").localeCompare(b.kind ?? "") ||
    (Number(a.label) || 0) - (Number(b.label) || 0) ||
    String(a.label).localeCompare(String(b.label));

  return {
    units: all.filter((g) => !g.building === false || g.kind).sort(sorter),
    unparsed: all.filter((g) => !g.building && !g.kind).sort((a, b) => b.count - a.count),
    withoutLocation,
  };
}

/** Rewrites every work in a place to one spelling. Returns how many changed. */
export function normalizeSpellings(key: string): number {
  const usage = locationUsage();
  const group = [...usage.units, ...usage.unparsed].find((u) => u.key === key);
  if (!group || group.spellings.length < 2) return 0;

  const database = getDb();
  const update = database.prepare(
    "UPDATE artworks SET location = @canonical, updated_at = datetime('now') WHERE location = @raw"
  );

  let changed = 0;
  database.transaction(() => {
    for (const spelling of group.spellings) {
      if (spelling.raw === group.canonical) continue;
      changed += update.run({ canonical: group.canonical, raw: spelling.raw }).changes;
    }
  })();
  return changed;
}
