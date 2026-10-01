/**
 * Places every stored work on the floor plan. Server-only.
 *
 * A place lands in a plan room, in this order:
 *   1. a room someone picked on the map (kept in `location_rooms`),
 *   2. the room number written in the cell itself ("480-13 caja 15" → 13),
 *   3. the room recorded for that unit in the storage-unit registry.
 * Drawers and boxes written without a room ("480 · Gaveta 5") stay unplaced
 * until someone puts them on the map; nothing is ever written back to the
 * «Localización» column.
 */

import { getDb } from "./db";
import { findRoom, planRoomId, roomById } from "./floorplan";
import { listUnits, locationKey, locationUsage, parseLocation, type UnitUsage } from "./locations";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS location_rooms (
  key TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
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

export type PlacementSource = "asignada" | "registro" | "unidad";

export type MapPlace = {
  key: string;
  canonical: string;
  building: string | null;
  count: number;
  /** `<floor id>|<room number>` on the plan, or null when not placed yet. */
  roomId: string | null;
  source: PlacementSource | null;
  /** No building and no drawer or box: a residence, "casa", "en sobre". */
  offsite: boolean;
};

export type MapWork = {
  registro: string;
  title: string | null;
  artist: string;
  thumb: string | null;
  place: string;
};

export function mapData(): { places: MapPlace[]; works: MapWork[] } {
  const { units: usage, unparsed } = locationUsage();
  const assigned = new Map(
    (db().prepare("SELECT key, room_id FROM location_rooms").all() as Array<{ key: string; room_id: string }>).map(
      (row) => [row.key, row.room_id]
    )
  );

  const unitRooms = new Map<string, string>();
  for (const unit of listUnits()) {
    if (!unit.room) continue;
    const ref = findRoom(unit.building, unit.room);
    if (ref) unitRooms.set(locationKey({ building: unit.building, kind: unit.kind, label: unit.label }), planRoomId(ref.floor, ref.room));
  }

  const place = (group: UnitUsage): MapPlace => {
    let roomId: string | null = null;
    let source: PlacementSource | null = null;

    const manual = assigned.get(group.key);
    if (manual && roomById(manual)) {
      roomId = manual;
      source = "asignada";
    } else {
      const ref = findRoom(group.building, group.room);
      if (ref) {
        roomId = planRoomId(ref.floor, ref.room);
        source = "registro";
      } else {
        const unitRoom = unitRooms.get(
          locationKey({ building: group.building, kind: group.kind, label: group.label })
        );
        if (unitRoom) {
          roomId = unitRoom;
          source = "unidad";
        }
      }
    }

    return {
      key: group.key,
      canonical: group.canonical,
      building: group.building,
      count: group.count,
      roomId,
      source,
      offsite: !group.building && !group.kind,
    };
  };

  const places = [...usage, ...unparsed].map(place);

  const rows = getDb()
    .prepare(
      `SELECT registro, title, artist_first, artist_last, image_thumb, location FROM artworks
        WHERE location IS NOT NULL AND TRIM(location) != ''`
    )
    .all() as Array<{
    registro: string;
    title: string | null;
    artist_first: string | null;
    artist_last: string | null;
    image_thumb: string | null;
    location: string;
  }>;

  const keyByRaw = new Map<string, string>();
  const works: MapWork[] = rows.map((row) => {
    let key = keyByRaw.get(row.location);
    if (key === undefined) {
      key = locationKey(parseLocation(row.location));
      keyByRaw.set(row.location, key);
    }
    return {
      registro: row.registro,
      title: row.title,
      artist: [row.artist_first, row.artist_last].filter(Boolean).join(" "),
      thumb: row.image_thumb,
      place: key,
    };
  });

  return { places, works };
}

/** Puts a place in a plan room, or takes it off the map with `roomId: null`. */
export function assignRoom(key: string, roomId: string | null): void {
  if (!key) throw new Error("Falta el lugar");
  if (roomId === null) {
    db().prepare("DELETE FROM location_rooms WHERE key = ?").run(key);
    return;
  }
  if (!roomById(roomId)) throw new Error("Esa sala no está en el plano");
  db()
    .prepare(
      `INSERT INTO location_rooms (key, room_id) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET room_id = excluded.room_id, updated_at = datetime('now')`
    )
    .run(key, roomId);
}

export type ArtworkPlacement = {
  /** The «Localización» cell as written. */
  raw: string;
  /** The place's key, for linking to the full map. */
  key: string;
  /** Building code read from the cell ("480"), when it names one. */
  building: string | null;
  roomId: string | null;
  source: PlacementSource | null;
  offsite: boolean;
};

/**
 * Where one work sits on the plan, by the same rules as `mapData`, without
 * scanning the whole collection. Null when the work has no location.
 */
export function placementFor(location: string | null | undefined): ArtworkPlacement | null {
  const raw = String(location ?? "").trim();
  if (!raw) return null;
  const parsed = parseLocation(raw);
  const key = locationKey(parsed);
  const offsite = !parsed.building && !parsed.kind;
  const building = parsed.building;

  const manual = (
    db().prepare("SELECT room_id FROM location_rooms WHERE key = ?").get(key) as { room_id: string } | undefined
  )?.room_id;
  if (manual && roomById(manual)) return { raw, key, building, roomId: manual, source: "asignada", offsite };

  const ref = findRoom(parsed.building, parsed.room);
  if (ref) return { raw, key, building, roomId: planRoomId(ref.floor, ref.room), source: "registro", offsite };

  const unitKey = locationKey({ building: parsed.building, kind: parsed.kind, label: parsed.label });
  for (const unit of listUnits()) {
    if (!unit.room) continue;
    if (locationKey({ building: unit.building, kind: unit.kind, label: unit.label }) !== unitKey) continue;
    const unitRef = findRoom(unit.building, unit.room);
    if (unitRef) return { raw, key, building, roomId: planRoomId(unitRef.floor, unitRef.room), source: "unidad", offsite };
  }

  return { raw, key, building, roomId: null, source: null, offsite };
}
