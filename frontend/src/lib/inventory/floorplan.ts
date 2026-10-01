/**
 * Digital floor plan of the 480 / 482 Calle José A. Canals buildings, traced
 * from the architect's printed plan.
 *
 * The print numbers every room on the site 1–28, and those are the same room
 * numbers the «Localización» column uses: "480-13 caja 15" is a box in room 13
 * (Conferencia), "482-17" is the 482 sala. So a parsed location's `room` lands
 * directly on this plan.
 *
 * DB-free on purpose (client components draw it). Coordinates are in the
 * print's own orientation — portrait, street at the bottom — because that is
 * how they were measured; `toView` turns each floor a quarter-turn so the room
 * labels read upright, which leaves the street on the left.
 *
 * Room and area names are kept in Spanish, as printed on the plan.
 */

export type Rect = { x: number; y: number; w: number; h: number };

export type PlanRoom = {
  /** Room number as printed on the plan and written in the spreadsheet. */
  number: string;
  name: string;
  /** One or more rectangles; L-shaped rooms are two. */
  rects: Rect[];
};

export type PlanArea = {
  /** Unnumbered spaces drawn for context: patios, carport, roofs, stairs. Blank when the print leaves it unlabelled. */
  name: string;
  rects: Rect[];
  kind: "patio" | "techo" | "escalera" | "pasillo";
};

export type Floor = {
  id: string;
  building: string;
  title: string;
  subtitle: string;
  /** Property line (dashed). */
  lot: Rect;
  /** Exterior walls of the built part (heavy line). */
  shell: Rect[];
  rooms: PlanRoom[];
  areas: PlanArea[];
  /** Spiral staircases: centre and radius. */
  spirals?: Array<{ cx: number; cy: number; r: number }>;
};

/** Portrait height of every floor; the quarter-turn maps y → VIEW_W - y. */
const PORTRAIT_H = 1420;

const r = (x1: number, y1: number, x2: number, y2: number): Rect => ({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });

export const FLOORS: Floor[] = [
  {
    id: "480-1",
    building: "480",
    title: "480 · Oficina",
    subtitle: "Planta baja",
    lot: r(200, 60, 810, 1345),
    shell: [r(330, 450, 670, 1272), r(210, 80, 555, 265), r(210, 265, 345, 345)],
    rooms: [
      { number: "1", name: "Entrada", rects: [r(435, 840, 670, 1060)] },
      { number: "2", name: "Cuarto núm. 1", rects: [r(485, 1060, 670, 1272)] },
      { number: "3", name: "Cuarto núm. 2", rects: [r(330, 1000, 485, 1195)] },
      { number: "4", name: "Baño 1", rects: [r(330, 850, 435, 1000)] },
      { number: "5", name: "Reproducción", rects: [r(330, 720, 440, 850)] },
      { number: "6", name: "Cocina", rects: [r(440, 720, 670, 840)] },
      { number: "7", name: "Taller", rects: [r(330, 450, 670, 720)] },
      { number: "8", name: "Almacén", rects: [r(210, 80, 555, 265)] },
      { number: "28", name: "Patio", rects: [r(345, 265, 670, 450)] },
    ],
    areas: [
      { name: "Baño 2", kind: "pasillo", rects: [r(210, 265, 345, 345)] },
      { name: "Patio lateral", kind: "patio", rects: [r(210, 345, 330, 1195)] },
      { name: "Patio", kind: "patio", rects: [r(670, 450, 810, 845)] },
      { name: "Marquesina", kind: "techo", rects: [r(670, 845, 810, 1345)] },
      { name: "Escalera", kind: "escalera", rects: [r(330, 1195, 485, 1272)] },
      { name: "Jardinera", kind: "patio", rects: [r(205, 1245, 265, 1340)] },
    ],
    spirals: [{ cx: 615, cy: 885, r: 34 }],
  },
  {
    id: "480-2",
    building: "480",
    title: "480 · Oficina",
    subtitle: "Altos",
    lot: r(160, 60, 790, 1335),
    shell: [r(295, 440, 635, 1335), r(380, 370, 545, 440)],
    rooms: [
      { number: "9", name: "Sala", rects: [r(455, 830, 635, 1180)] },
      { number: "10", name: "Cuarto núm. 1", rects: [r(295, 850, 455, 1180)] },
      { number: "11", name: "Reproducción", rects: [r(395, 720, 635, 830)] },
      { number: "12", name: "Baño", rects: [r(295, 710, 395, 850)] },
      { number: "13", name: "Conferencia", rects: [r(295, 440, 635, 620), r(400, 620, 635, 720)] },
      { number: "14", name: "Cocina", rects: [r(295, 620, 400, 710)] },
      { number: "15", name: "Almacén", rects: [r(380, 370, 545, 440)] },
      { number: "27", name: "Balcón", rects: [r(490, 1180, 635, 1250)] },
      { number: "28", name: "Techo marquesina", rects: [r(640, 840, 790, 1210)] },
    ],
    areas: [
      { name: "Techo almacén", kind: "techo", rects: [r(175, 60, 540, 250), r(175, 250, 310, 335)] },
      { name: "Escalera", kind: "escalera", rects: [r(295, 1180, 490, 1250)] },
      { name: "Balcón", kind: "patio", rects: [r(295, 1250, 635, 1335)] },
    ],
    spirals: [{ cx: 590, cy: 870, r: 36 }],
  },
  {
    id: "482",
    building: "482",
    title: "482 · Almacén",
    subtitle: "Planta baja",
    lot: r(15, 55, 635, 1335),
    shell: [r(135, 320, 505, 1160), r(95, 1160, 455, 1330), r(35, 60, 245, 220)],
    rooms: [
      { number: "16", name: "Balcón", rects: [r(95, 1160, 455, 1330)] },
      { number: "17", name: "Sala", rects: [r(300, 710, 505, 1045)] },
      { number: "18", name: "Cuarto núm. 1", rects: [r(135, 985, 300, 1160)] },
      { number: "19", name: "Baño 1", rects: [r(135, 880, 245, 985)] },
      { number: "20", name: "Cuarto núm. 2", rects: [r(135, 710, 300, 880)] },
      { number: "21", name: "", rects: [r(135, 620, 290, 710)] },
      { number: "22", name: "Cocina", rects: [r(290, 505, 505, 710)] },
      { number: "23", name: "Baño 2", rects: [r(135, 505, 290, 620)] },
      { number: "24", name: "Cuarto núm. 3", rects: [r(135, 320, 505, 505)] },
      { number: "25", name: "Almacén", rects: [r(35, 60, 245, 220)] },
      { number: "26", name: "", rects: [r(250, 155, 355, 225)] },
    ],
    areas: [
      { name: "Patio lateral", kind: "patio", rects: [r(505, 330, 625, 885)] },
      { name: "Marquesina", kind: "techo", rects: [r(455, 1045, 615, 1335)] },
      { name: "Pasillo", kind: "pasillo", rects: [r(245, 880, 300, 985), r(300, 1045, 455, 1160)] },
      { name: "", kind: "pasillo", rects: [r(25, 230, 135, 1150)] },
    ],
  },
];

/** Upright view: a quarter-turn clockwise, so labels read left to right. */
export function toView(rect: Rect): Rect {
  return { x: PORTRAIT_H - (rect.y + rect.h), y: rect.x, w: rect.h, h: rect.w };
}

export function toViewPoint(x: number, y: number): { x: number; y: number } {
  return { x: PORTRAIT_H - y, y: x };
}

/** Bounding box of a floor in view coordinates. */
export function floorBounds(floor: Floor): Rect {
  return toView(floor.lot);
}

/** Every room on the site, keyed `<building>|<number>`. */
export function roomKey(building: string, number: string): string {
  return `${building}|${number}`;
}

export type RoomRef = { floor: Floor; room: PlanRoom };

const ROOM_INDEX = new Map<string, RoomRef>();
for (const floor of FLOORS) {
  for (const room of floor.rooms) {
    const key = roomKey(floor.building, room.number);
    if (!ROOM_INDEX.has(key)) ROOM_INDEX.set(key, { floor, room });
  }
}

/**
 * Finds the plan room a location points at. Numbers 1–15 and 27–28 are in 480,
 * 16–26 in 482; when the building is missing or disagrees with the number, the
 * number wins, since it is unique on the plan (except 28, which both 480
 * floors use — the ground-floor patio is taken).
 */
export function findRoom(building: string | null, number: string | null): RoomRef | null {
  if (!number) return null;
  if (building) {
    const exact = ROOM_INDEX.get(roomKey(building, number));
    if (exact) return exact;
  }
  for (const ref of ROOM_INDEX.values()) if (ref.room.number === number) return ref;
  return null;
}

/** Stable id for a room on a specific floor (28 exists on two 480 floors). */
/** "Conferencia", or "Sala 21" for the rooms the print leaves unnamed. */
export function roomName(room: PlanRoom): string {
  return room.name || `Sala ${room.number}`;
}

export function planRoomId(floor: Floor, room: PlanRoom): string {
  return `${floor.id}|${room.number}`;
}

export function roomById(id: string): RoomRef | null {
  const [floorId, number] = id.split("|");
  const floor = FLOORS.find((f) => f.id === floorId);
  const room = floor?.rooms.find((rm) => rm.number === number);
  return floor && room ? { floor, room } : null;
}
