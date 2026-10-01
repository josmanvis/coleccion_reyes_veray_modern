import { getDb, getArtwork, updateArtwork } from "./db";
import { FIELDS, FIELD_BY_KEY } from "./fields";
import { applyOutbound, type FileMakerMode, type FileMakerRecord } from "./filemaker";

/**
 * Two-way comparison between CRVMGMT and FileMaker Pro.
 *
 * Every differing field is listed with both values and no default winner. The
 * owner chooses a direction per field, and only then is anything written —
 * inbound into the local records, outbound into the FileMaker file. A field
 * left undecided is not touched on either side.
 */

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);
CREATE TABLE IF NOT EXISTS sync_fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  ref TEXT,
  registro TEXT NOT NULL,
  title TEXT,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  column_name TEXT NOT NULL,
  app_value TEXT NOT NULL DEFAULT '',
  fm_value TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,
  decision TEXT NOT NULL DEFAULT 'undecided',
  applied_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sync_fields_run ON sync_fields(run_id);
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

/** Excel and FileMaker disagree about line endings; compare on normalised text. */
function comparable(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\r\n?/g, "\n").trim();
}

export type SyncDecision = "undecided" | "use_filemaker" | "use_app" | "skip";

export type SyncFieldRow = {
  id: number;
  ref: string | null;
  registro: string;
  title: string | null;
  field_key: string;
  label: string;
  column_name: string;
  app_value: string;
  fm_value: string;
  /** "both" when the record exists on each side; otherwise which side has it. */
  kind: "both" | "only_filemaker" | "only_app";
  decision: SyncDecision;
  applied_at: string | null;
};

export type SyncRun = {
  id: number;
  mode: string;
  source: string | null;
  created_at: string;
  counts: {
    fields: number;
    records: number;
    undecided: number;
    inbound: number;
    outbound: number;
    applied: number;
  };
};

/**
 * Builds a run from a FileMaker snapshot. Records are matched on registro,
 * which is how both systems identify a work.
 */
export function createSyncRun(
  mode: FileMakerMode,
  source: string,
  records: FileMakerRecord[]
): SyncRun {
  const handle = db();

  const create = handle.transaction(() => {
    const run = handle.prepare("INSERT INTO sync_runs (mode, source) VALUES (?, ?)").run(mode, source);
    const runId = Number(run.lastInsertRowid);

    const insert = handle.prepare(
      `INSERT INTO sync_fields
         (run_id, ref, registro, title, field_key, label, column_name, app_value, fm_value, kind)
       VALUES (@run_id, @ref, @registro, @title, @field_key, @label, @column_name, @app_value, @fm_value, @kind)`
    );

    const seen = new Set<string>();

    for (const record of records) {
      const registro = comparable(record.registro);
      if (!registro) continue;
      seen.add(registro);

      const local = handle
        .prepare("SELECT * FROM artworks WHERE registro = ? ORDER BY id LIMIT 1")
        .get(registro) as Record<string, unknown> | undefined;

      for (const field of FIELDS) {
        if (field.key === "registro") continue;
        const fmValue = comparable(record[field.key]);
        const appValue = local ? comparable(local[field.key]) : "";
        if (fmValue === appValue) continue;

        insert.run({
          run_id: runId,
          ref: local ? String(local.ref) : null,
          registro,
          title: local ? comparable(local.title) : comparable(record.title),
          field_key: field.key,
          label: field.label,
          column_name: field.column,
          app_value: appValue,
          fm_value: fmValue,
          kind: local ? "both" : "only_filemaker",
        });
      }
    }

    // Records the app has that the snapshot does not mention at all.
    const localOnly = handle
      .prepare("SELECT ref, registro, title FROM artworks WHERE registro IS NOT NULL")
      .all() as Array<Record<string, unknown>>;
    for (const row of localOnly) {
      const registro = comparable(row.registro);
      if (!registro || seen.has(registro)) continue;
      insert.run({
        run_id: runId,
        ref: String(row.ref),
        registro,
        title: comparable(row.title),
        field_key: "registro",
        label: "Obra completa",
        column_name: "# Registro",
        app_value: registro,
        fm_value: "",
        kind: "only_app",
      });
    }

    return runId;
  });

  return getSyncRun(create())!;
}

export function getSyncRun(id: number): SyncRun | null {
  const handle = db();
  const run = handle.prepare("SELECT * FROM sync_runs WHERE id = ?").get(id) as
    | { id: number; mode: string; source: string | null; created_at: string }
    | undefined;
  if (!run) return null;

  const counts = handle
    .prepare(
      `SELECT COUNT(*) AS fields,
              COUNT(DISTINCT registro) AS records,
              SUM(CASE WHEN decision = 'undecided' THEN 1 ELSE 0 END) AS undecided,
              SUM(CASE WHEN decision = 'use_filemaker' THEN 1 ELSE 0 END) AS inbound,
              SUM(CASE WHEN decision = 'use_app' THEN 1 ELSE 0 END) AS outbound,
              SUM(CASE WHEN applied_at IS NOT NULL THEN 1 ELSE 0 END) AS applied
         FROM sync_fields WHERE run_id = ?`
    )
    .get(id) as Record<string, number>;

  return {
    ...run,
    counts: {
      fields: counts.fields ?? 0,
      records: counts.records ?? 0,
      undecided: counts.undecided ?? 0,
      inbound: counts.inbound ?? 0,
      outbound: counts.outbound ?? 0,
      applied: counts.applied ?? 0,
    },
  };
}

export function latestSyncRun(): SyncRun | null {
  const row = db().prepare("SELECT id FROM sync_runs ORDER BY id DESC LIMIT 1").get() as
    | { id: number }
    | undefined;
  return row ? getSyncRun(row.id) : null;
}

export function listSyncFields(runId: number, limit = 400): SyncFieldRow[] {
  return db()
    .prepare(
      `SELECT * FROM sync_fields WHERE run_id = ?
        ORDER BY (applied_at IS NULL) DESC, registro ASC, label ASC LIMIT ?`
    )
    .all(runId, limit) as SyncFieldRow[];
}

export function decide(runId: number, ids: number[], decision: SyncDecision): number {
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => "?").join(", ");
  return db()
    .prepare(
      `UPDATE sync_fields SET decision = ?
        WHERE run_id = ? AND applied_at IS NULL AND id IN (${placeholders})`
    )
    .run(decision, runId, ...ids).changes;
}

/**
 * Carries out the decisions. Inbound edits are written here; outbound edits are
 * handed to FileMaker one cell at a time. Undecided fields are left alone.
 */
export async function applySyncRun(
  runId: number,
  target: { database?: string; connectionString?: string; table?: string }
) {
  const handle = db();
  const run = getSyncRun(runId);
  if (!run) throw new Error("Comparación no encontrada");

  const rows = handle
    .prepare(
      `SELECT * FROM sync_fields
        WHERE run_id = ? AND applied_at IS NULL AND decision IN ('use_filemaker', 'use_app')`
    )
    .all(runId) as SyncFieldRow[];

  const markApplied = handle.prepare("UPDATE sync_fields SET applied_at = datetime('now') WHERE id = ?");
  const result = {
    inbound: { applied: 0, failed: 0 },
    outbound: { applied: 0, failed: 0 },
    errors: [] as string[],
  };

  // Inbound: FileMaker wins, write into the local records.
  for (const row of rows.filter((r) => r.decision === "use_filemaker")) {
    if (!row.ref || !FIELD_BY_KEY.has(row.field_key)) {
      result.inbound.failed += 1;
      result.errors.push(`${row.registro}: la obra no existe localmente todavía`);
      continue;
    }
    try {
      updateArtwork(row.ref, { [row.field_key]: row.fm_value });
      markApplied.run(row.id);
      result.inbound.applied += 1;
    } catch (error) {
      result.inbound.failed += 1;
      result.errors.push(`${row.registro} · ${row.label}: ${(error as Error).message}`);
    }
  }

  // Outbound: CRVMGMT wins, write into the FileMaker file.
  const outbound = rows.filter((r) => r.decision === "use_app" && r.kind === "both");
  if (outbound.length > 0) {
    const written = await applyOutbound(
      run.mode as FileMakerMode,
      target,
      outbound.map((row) => ({
        registro: row.registro,
        column: row.column_name,
        before: row.fm_value,
        after: row.app_value,
      }))
    );
    result.outbound.applied = written.applied;
    result.outbound.failed = written.failed;
    result.errors.push(...written.errors);

    // Only mark the ones that went through; a failure stays pending.
    if (written.failed === 0) {
      for (const row of outbound) markApplied.run(row.id);
    }
  }

  if (getSyncRun(runId)!.counts.undecided === 0) {
    handle.prepare("UPDATE sync_runs SET closed_at = datetime('now') WHERE id = ?").run(runId);
  }
  return result;
}

export function discardSyncRun(runId: number) {
  const handle = db();
  handle.prepare("DELETE FROM sync_fields WHERE run_id = ?").run(runId);
  handle.prepare("DELETE FROM sync_runs WHERE id = ?").run(runId);
}
