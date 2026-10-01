import { getDb } from "./db";
import { moveToTrash } from "./trash";
import type { Actor } from "./audit";

/**
 * Clocking in and out.
 *
 * A shift is one row that starts open — `ended_at` null — and is closed when
 * the person clocks out. One open shift per person at a time, enforced when
 * clocking in rather than trusted to the interface, since the same account can
 * be signed in on the desktop and on a browser at once.
 *
 * Times are stored as UTC with an explicit Z. The studio is one timezone today,
 * but hours worked is the kind of record that gets read years later, and a
 * naive local timestamp is unreadable the moment the reader is somewhere else.
 * Formatting into local time is the browser's job.
 *
 * Nothing here is ever silently rewritten: an adjustment keeps who made it,
 * when, and why, and the caller writes the change to the signed history.
 */

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  note TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL DEFAULT '',
  edited_by INTEGER,
  edited_by_name TEXT NOT NULL DEFAULT '',
  edited_at TEXT,
  edit_reason TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_time_user ON time_entries(user_id, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_time_one_open
  ON time_entries(user_id) WHERE ended_at IS NULL;
`;

let ready = false;

function db() {
  const handle = getDb();
  if (!ready) {
    handle.exec(CREATE_SQL);
    ready = true;
  }
  return handle;
}

const NOW = `strftime('%Y-%m-%dT%H:%M:%SZ','now')`;

export type Shift = {
  id: number;
  userId: number;
  userName: string;
  startedAt: string;
  endedAt: string | null;
  note: string;
  origin: string;
  /** Whole minutes; for an open shift, up to this moment. */
  minutes: number;
  editedBy: number | null;
  editedByName: string;
  editedAt: string | null;
  editReason: string;
};

function hydrate(row: Record<string, unknown>): Shift {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    userName: String(row.user_name ?? ""),
    startedAt: String(row.started_at),
    endedAt: row.ended_at === null ? null : String(row.ended_at),
    note: String(row.note ?? ""),
    origin: String(row.origin ?? ""),
    minutes: Math.max(0, Number(row.minutes ?? 0)),
    editedBy: row.edited_by === null || row.edited_by === undefined ? null : Number(row.edited_by),
    editedByName: String(row.edited_by_name ?? ""),
    editedAt: row.edited_at === null || row.edited_at === undefined ? null : String(row.edited_at),
    editReason: String(row.edit_reason ?? ""),
  };
}

/** An open shift counts up to now, so the interface can show it running. */
const SELECT = `
  SELECT t.*, u.name AS user_name,
         CAST((julianday(COALESCE(t.ended_at, ${NOW})) - julianday(t.started_at)) * 1440 AS INTEGER) AS minutes
    FROM time_entries t
    JOIN users u ON u.id = t.user_id
`;

export function openShift(userId: number): Shift | null {
  const row = db()
    .prepare(`${SELECT} WHERE t.user_id = ? AND t.ended_at IS NULL`)
    .get(userId) as Record<string, unknown> | undefined;
  return row ? hydrate(row) : null;
}

export function getShift(id: number): Shift | null {
  const row = db().prepare(`${SELECT} WHERE t.id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? hydrate(row) : null;
}

export function clockIn(userId: number, origin: string): Shift {
  if (openShift(userId)) throw new Error("Ya tienes una entrada abierta");
  const result = db()
    .prepare(
      `INSERT INTO time_entries (user_id, started_at, origin) VALUES (?, ${NOW}, ?)`
    )
    .run(userId, origin);
  return getShift(Number(result.lastInsertRowid))!;
}

export function clockOut(userId: number, note = ""): Shift {
  const open = openShift(userId);
  if (!open) throw new Error("No tienes una entrada abierta");
  db()
    .prepare(`UPDATE time_entries SET ended_at = ${NOW}, note = ? WHERE id = ?`)
    .run(note.trim().slice(0, 500), open.id);
  return getShift(open.id)!;
}

export type ShiftQuery = {
  userId?: number;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

function clauses(query: ShiftQuery) {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (query.userId) {
    where.push("t.user_id = @userId");
    params.userId = query.userId;
  }
  if (query.from) {
    where.push("t.started_at >= @from");
    params.from = `${query.from}T00:00:00Z`;
  }
  if (query.to) {
    where.push("t.started_at <= @to");
    params.to = `${query.to}T23:59:59Z`;
  }
  return { clause: where.length > 0 ? `WHERE ${where.join(" AND ")}` : "", params };
}

export function listShifts(query: ShiftQuery = {}): {
  shifts: Shift[];
  total: number;
  minutes: number;
} {
  const { clause, params } = clauses(query);
  const handle = db();

  const rows = handle
    .prepare(`${SELECT} ${clause} ORDER BY t.started_at DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: query.limit ?? 100, offset: query.offset ?? 0 }) as Array<
    Record<string, unknown>
  >;

  const totals = handle
    .prepare(
      `SELECT COUNT(*) AS n,
              COALESCE(SUM(CAST((julianday(COALESCE(t.ended_at, ${NOW})) - julianday(t.started_at)) * 1440 AS INTEGER)), 0) AS minutes
         FROM time_entries t ${clause}`
    )
    .get(params) as { n: number; minutes: number };

  return { shifts: rows.map(hydrate), total: totals.n, minutes: Math.max(0, totals.minutes) };
}

/** Hours per person over a range, for the summary at the top of the page. */
export function totalsByUser(query: ShiftQuery = {}) {
  const { clause, params } = clauses(query);
  return db()
    .prepare(
      `SELECT t.user_id AS userId, u.name AS userName,
              COUNT(*) AS shifts,
              COALESCE(SUM(CAST((julianday(COALESCE(t.ended_at, ${NOW})) - julianday(t.started_at)) * 1440 AS INTEGER)), 0) AS minutes,
              SUM(CASE WHEN t.ended_at IS NULL THEN 1 ELSE 0 END) AS open
         FROM time_entries t
         JOIN users u ON u.id = t.user_id
         ${clause}
        GROUP BY t.user_id, u.name
        ORDER BY minutes DESC`
    )
    .all(params) as Array<{
    userId: number;
    userName: string;
    shifts: number;
    minutes: number;
    open: number;
  }>;
}

const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/**
 * Corrects a shift. Only the superadmin reaches this, and the reason is
 * required — a corrected timesheet with no explanation is worse than a wrong
 * one, because nothing marks it as touched.
 */
export function adjustShift(
  id: number,
  input: { startedAt?: string; endedAt?: string | null; note?: string; reason: string },
  editor: { id: number; name: string }
): { before: Shift; after: Shift } {
  const before = getShift(id);
  if (!before) throw new Error("Registro no encontrado");
  if (!input.reason?.trim()) throw new Error("Hace falta indicar el motivo del ajuste");

  const startedAt = input.startedAt ?? before.startedAt;
  const endedAt = input.endedAt === undefined ? before.endedAt : input.endedAt;

  if (!STAMP.test(startedAt)) throw new Error("La hora de entrada no es válida");
  if (endedAt !== null) {
    if (!STAMP.test(endedAt)) throw new Error("La hora de salida no es válida");
    if (endedAt <= startedAt) throw new Error("La salida tiene que ser posterior a la entrada");
  }

  db()
    .prepare(
      `UPDATE time_entries
          SET started_at = @startedAt, ended_at = @endedAt, note = @note,
              edited_by = @editorId, edited_by_name = @editorName,
              edited_at = ${NOW}, edit_reason = @reason
        WHERE id = @id`
    )
    .run({
      id,
      startedAt,
      endedAt,
      note: (input.note ?? before.note).trim().slice(0, 500),
      editorId: editor.id,
      editorName: editor.name,
      reason: input.reason.trim().slice(0, 500),
    });

  return { before, after: getShift(id)! };
}

/** Moves the shift to the trash; returns it as it was, with the trash id. */
export function deleteShift(id: number, actor?: Actor | null, reason = ""): (Shift & { trashId: number }) | null {
  const before = getShift(id);
  if (!before) return null;
  const trashId = moveToTrash({
    entity: "jornada",
    entityId: String(id),
    label: `Jornada de ${before.userName} · ${before.startedAt.slice(0, 10)}`,
    detail: reason,
    rows: [{ table: "time_entries", where: "id = ?", args: [id] }],
    actor,
  });
  return trashId === null ? null : { ...before, trashId };
}

/** "7 h 45 min", the way the totals read on screen. */
export function formatMinutes(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
