import { getDb, getArtwork, createArtwork, updateArtwork } from "./db";
import { FIELDS, FIELD_BY_KEY } from "./fields";
import type { ParsedRow, ParsedWorkbook } from "./import";

/**
 * A staged import: the spreadsheet is parsed and compared against the records,
 * and nothing is written until each change is confirmed.
 *
 * The proposal is kept in SQLite rather than in memory so a review survives a
 * reload, and so approving is a decision about a stored row rather than about
 * a file the server no longer has.
 */

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS import_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  applied_at TEXT
);
CREATE TABLE IF NOT EXISTS import_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  ref TEXT NOT NULL,
  registro TEXT,
  kind TEXT NOT NULL,
  title TEXT,
  artist TEXT,
  diff_json TEXT NOT NULL,
  values_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_import_changes_session ON import_changes(session_id);
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

export type FieldDiff = { key: string; label: string; before: string; after: string };

export type StagedChange = {
  id: number;
  ref: string;
  registro: string | null;
  kind: "new" | "update";
  title: string | null;
  artist: string | null;
  status: "pending" | "applied" | "skipped";
  diff: FieldDiff[];
};

export type StagedSession = {
  id: number;
  filename: string;
  created_at: string;
  applied_at: string | null;
  counts: { total: number; nuevas: number; cambios: number; pending: number; applied: number };
};

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/**
 * Excel hands back in-cell line breaks as CR while the stored value uses LF,
 * and cells carry stray trailing space. Comparing raw made ~480 records look
 * changed when only the line endings differed, which buried the real edits.
 */
function comparable(value: unknown): string {
  return text(value).replace(/\r\n?/g, "\n").trim();
}

/** Only the fields the spreadsheet actually carries are compared. */
function diffRow(row: ParsedRow, present: Set<string>): FieldDiff[] {
  const current = getArtwork(row.ref);
  const diffs: FieldDiff[] = [];

  for (const field of FIELDS) {
    if (!present.has(field.key)) continue;
    const after = comparable(row.values[field.key]);
    const before = current ? comparable(current[field.key]) : "";
    if (before !== after) {
      diffs.push({ key: field.key, label: field.label, before, after });
    }
  }
  return diffs;
}

export function stageImport(filename: string, parsed: ParsedWorkbook): StagedSession {
  const handle = db();
  const present = new Set(
    FIELDS.filter((f) => !parsed.missingColumns.includes(f.label)).map((f) => f.key)
  );

  const create = handle.transaction(() => {
    const session = handle
      .prepare("INSERT INTO import_sessions (filename) VALUES (?)")
      .run(filename);
    const sessionId = Number(session.lastInsertRowid);

    const insert = handle.prepare(
      `INSERT INTO import_changes (session_id, ref, registro, kind, title, artist, diff_json, values_json)
       VALUES (@session_id, @ref, @registro, @kind, @title, @artist, @diff_json, @values_json)`
    );

    for (const row of parsed.rows) {
      const existing = getArtwork(row.ref);
      const diff = diffRow(row, present);
      // An unchanged record is not a decision worth asking about.
      if (existing && diff.length === 0) continue;

      const normalised: Record<string, unknown> = { ...row.values };
      for (const field of FIELDS) {
        if (typeof normalised[field.key] === "string") {
          normalised[field.key] = comparable(normalised[field.key]) || null;
        }
      }

      insert.run({
        session_id: sessionId,
        ref: row.ref,
        registro: row.registro || null,
        kind: existing ? "update" : "new",
        title: text(row.values.title) || null,
        artist: [row.values.artist_first, row.values.artist_last].filter(Boolean).join(" ") || null,
        diff_json: JSON.stringify(diff),
        values_json: JSON.stringify(normalised),
      });
    }

    return sessionId;
  });

  return getSession(create())!;
}

export function getSession(id: number): StagedSession | null {
  const handle = db();
  const session = handle.prepare("SELECT * FROM import_sessions WHERE id = ?").get(id) as
    | { id: number; filename: string; created_at: string; applied_at: string | null }
    | undefined;
  if (!session) return null;

  const counts = handle
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN kind = 'new' THEN 1 ELSE 0 END) AS nuevas,
              SUM(CASE WHEN kind = 'update' THEN 1 ELSE 0 END) AS cambios,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
              SUM(CASE WHEN status = 'applied' THEN 1 ELSE 0 END) AS applied
         FROM import_changes WHERE session_id = ?`
    )
    .get(id) as Record<string, number>;

  return {
    ...session,
    counts: {
      total: counts.total ?? 0,
      nuevas: counts.nuevas ?? 0,
      cambios: counts.cambios ?? 0,
      pending: counts.pending ?? 0,
      applied: counts.applied ?? 0,
    },
  };
}

export function latestSession(): StagedSession | null {
  const row = db()
    .prepare("SELECT id FROM import_sessions ORDER BY id DESC LIMIT 1")
    .get() as { id: number } | undefined;
  return row ? getSession(row.id) : null;
}

export function listChanges(sessionId: number, limit = 200, offset = 0): StagedChange[] {
  return (
    db()
      .prepare(
        `SELECT id, ref, registro, kind, title, artist, status, diff_json
           FROM import_changes WHERE session_id = ?
          ORDER BY (status = 'pending') DESC, id ASC LIMIT ? OFFSET ?`
      )
      .all(sessionId, limit, offset) as Array<Record<string, unknown>>
  ).map((row) => ({
    id: Number(row.id),
    ref: String(row.ref),
    registro: row.registro === null ? null : String(row.registro),
    kind: row.kind as "new" | "update",
    title: row.title === null ? null : String(row.title),
    artist: row.artist === null ? null : String(row.artist),
    status: row.status as StagedChange["status"],
    diff: JSON.parse(String(row.diff_json)) as FieldDiff[],
  }));
}

/**
 * Applies only the changes named, one record at a time. Each goes through the
 * normal create/update path, so derived columns are recomputed exactly as they
 * are for a hand edit.
 */
export function applyChanges(sessionId: number, changeIds: number[]) {
  const handle = db();
  const result = { applied: 0, failed: 0, errors: [] as string[] };
  if (changeIds.length === 0) return result;

  const placeholders = changeIds.map(() => "?").join(", ");
  const rows = handle
    .prepare(
      `SELECT * FROM import_changes
        WHERE session_id = ? AND status = 'pending' AND id IN (${placeholders})`
    )
    .all(sessionId, ...changeIds) as Array<Record<string, unknown>>;

  const markApplied = handle.prepare("UPDATE import_changes SET status = 'applied' WHERE id = ?");

  for (const row of rows) {
    const values = JSON.parse(String(row.values_json)) as Record<string, unknown>;
    const diff = JSON.parse(String(row.diff_json)) as FieldDiff[];
    try {
      if (row.kind === "new") {
        createArtwork(values);
      } else {
        // Write back only what the review showed as changing.
        const patch: Record<string, unknown> = {};
        for (const entry of diff) {
          if (FIELD_BY_KEY.has(entry.key)) patch[entry.key] = values[entry.key];
        }
        updateArtwork(String(row.ref), patch);
      }
      markApplied.run(row.id);
      result.applied += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push(`${row.registro ?? row.ref}: ${(error as Error).message}`);
    }
  }

  if (result.applied > 0) {
    handle
      .prepare("UPDATE import_sessions SET applied_at = datetime('now') WHERE id = ?")
      .run(sessionId);
  }
  return result;
}

export function skipChanges(sessionId: number, changeIds: number[]) {
  if (changeIds.length === 0) return 0;
  const placeholders = changeIds.map(() => "?").join(", ");
  return db()
    .prepare(
      `UPDATE import_changes SET status = 'skipped'
        WHERE session_id = ? AND status = 'pending' AND id IN (${placeholders})`
    )
    .run(sessionId, ...changeIds).changes;
}

export function discardSession(sessionId: number) {
  const handle = db();
  handle.prepare("DELETE FROM import_changes WHERE session_id = ?").run(sessionId);
  handle.prepare("DELETE FROM import_sessions WHERE id = ?").run(sessionId);
}
