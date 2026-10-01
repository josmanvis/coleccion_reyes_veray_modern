import fs from "node:fs";
import path from "node:path";
import { databasePath, getDb } from "./db";
import { CERTIFICATE_DIR } from "./certificate-files";
import { UPLOAD_DIR } from "./uploads";
import type { Actor } from "./audit";

/**
 * The trash: nothing a person deletes is erased.
 *
 * Deleting snapshots the row (and any rows that only exist under it, like a
 * building's storage units) into `trash` and moves its files to `data/trash/`,
 * in one step. Restoring writes the same rows back with their original ids —
 * every table uses AUTOINCREMENT, so an id is never handed to anything else —
 * and moves the files home. Only an explicit "delete forever" removes data.
 *
 * Trashed files live beside the database rather than in a hidden folder next
 * to the originals: uploads sit under public/, which the server publishes.
 */

import type { TrashEntity, TrashItem } from "./trash-types";

export * from "./trash-types";

/** Tables a snapshot may write back to; anything else in the column is refused. */
const TABLES = new Set(["artworks", "certificates", "pages", "media", "buildings", "storage_units", "time_entries", "market_sales"]);

/** Where each kind of file normally lives. */
const FILE_DIRS = { certificates: () => CERTIFICATE_DIR, uploads: () => UPLOAD_DIR } as const;
type FileDir = keyof typeof FILE_DIRS;

type Snapshot = Array<{ table: string; rows: Array<Record<string, unknown>> }>;
type TrashedFile = { dir: FileDir; name: string; stored: string | null };

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS trash (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  label TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  snapshot_json TEXT NOT NULL,
  files_json TEXT NOT NULL DEFAULT '[]',
  deleted_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_by_id INTEGER,
  deleted_by_name TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_trash_deleted ON trash(deleted_at DESC);
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

export function trashFilesDir(): string {
  return path.join(path.dirname(databasePath()), "trash");
}

function originalPath(file: { dir: FileDir; name: string }): string {
  // basename: a stored name never points outside its folder.
  return path.join(FILE_DIRS[file.dir](), path.basename(file.name));
}

function columnsOf(table: string): Set<string> {
  const info = db().prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return new Set(info.map((c) => c.name));
}

/**
 * Moves one record — and the rows and files that belong to it — to the trash.
 * `rows` lists the parent selection first; children are deleted before it.
 * Returns the trash id, or null when the parent row does not exist.
 */
export function moveToTrash(input: {
  entity: TrashEntity;
  entityId: string;
  label: string;
  detail?: string;
  rows: Array<{ table: string; where: string; args: unknown[] }>;
  files?: Array<{ dir: FileDir; name: string }>;
  actor?: Actor | null;
}): number | null {
  const handle = db();

  const id = handle.transaction(() => {
    const snapshot: Snapshot = input.rows.map(({ table, where, args }) => {
      if (!TABLES.has(table)) throw new Error(`Tabla no permitida: ${table}`);
      return { table, rows: handle.prepare(`SELECT * FROM ${table} WHERE ${where}`).all(...args) as Array<Record<string, unknown>> };
    });
    if (snapshot[0].rows.length === 0) return null;

    const info = handle
      .prepare(
        `INSERT INTO trash (entity, entity_id, label, detail, snapshot_json, deleted_by_id, deleted_by_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.entity,
        input.entityId,
        input.label,
        input.detail ?? "",
        JSON.stringify(snapshot),
        input.actor?.id ?? null,
        input.actor?.name ?? ""
      );

    for (const { table, where, args } of [...input.rows].reverse()) {
      handle.prepare(`DELETE FROM ${table} WHERE ${where}`).run(...args);
    }
    return Number(info.lastInsertRowid);
  })();

  if (id === null) return null;

  // Files move after the rows are safely in the trash. A file that is already
  // missing is recorded as such rather than failing the delete.
  const files: TrashedFile[] = [];
  if (input.files?.length) {
    fs.mkdirSync(trashFilesDir(), { recursive: true });
    for (const file of input.files) {
      const from = originalPath(file);
      const stored = `${id}-${file.dir}-${path.basename(file.name)}`;
      try {
        fs.renameSync(from, path.join(trashFilesDir(), stored));
        files.push({ ...file, stored });
      } catch {
        files.push({ ...file, stored: null });
      }
    }
    handle.prepare("UPDATE trash SET files_json = ? WHERE id = ?").run(JSON.stringify(files), id);
  }

  return id;
}

export function listTrash(): TrashItem[] {
  const rows = db()
    .prepare(
      `SELECT id, entity, entity_id, label, detail, deleted_at, deleted_by_name, files_json
         FROM trash ORDER BY deleted_at DESC, id DESC`
    )
    .all() as Array<Omit<TrashItem, "files"> & { files_json: string }>;
  return rows.map(({ files_json, ...row }) => ({
    ...row,
    files: (JSON.parse(files_json) as TrashedFile[]).filter((f) => f.stored).length,
  }));
}

export function countTrash(): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM trash").get() as { n: number }).n;
}

type Raw = TrashItem & { snapshot_json: string; files_json: string };

function getRaw(id: number): Raw | null {
  return (db().prepare("SELECT * FROM trash WHERE id = ?").get(id) as Raw | undefined) ?? null;
}

/** Where the restored record can be opened. */
function hrefFor(entity: TrashEntity, snapshot: Snapshot): string | null {
  const row = snapshot[0]?.rows[0] ?? {};
  switch (entity) {
    case "obra":
      return `/inventory/${encodeURIComponent(String(row.ref))}`;
    case "certificado":
      return "/admin/certificates";
    case "pagina":
      return `/admin/content/${encodeURIComponent(String(row.slug))}`;
    case "edificio":
    case "unidad":
      return "/admin/locations";
    case "jornada":
      return "/admin/hours";
    case "venta":
      return "/admin/valuations";
    default:
      return null;
  }
}

/**
 * Puts a trashed record back exactly as it was. Refuses, without changing
 * anything, when something new has since taken its place (the same registro
 * ref, page address or building code).
 */
export function restoreFromTrash(id: number): { entity: TrashEntity; entityId: string; label: string; href: string | null } {
  const item = getRaw(id);
  if (!item) throw new Error("No está en la papelera");

  const snapshot = JSON.parse(item.snapshot_json) as Snapshot;
  const files = (JSON.parse(item.files_json) as TrashedFile[]).filter((f) => f.stored);

  for (const file of files) {
    if (fs.existsSync(originalPath(file))) {
      throw new Error(`Ya existe un archivo con el nombre ${file.name}; no se puede restaurar encima`);
    }
  }

  // Files first, so a failed database write can put them straight back.
  const moved: TrashedFile[] = [];
  const unmove = () => {
    for (const file of moved) {
      try {
        fs.renameSync(originalPath(file), path.join(trashFilesDir(), file.stored!));
      } catch {
        /* left where it is; the trash entry still lists it */
      }
    }
  };
  try {
    for (const file of files) {
      fs.mkdirSync(path.dirname(originalPath(file)), { recursive: true });
      fs.renameSync(path.join(trashFilesDir(), file.stored!), originalPath(file));
      moved.push(file);
    }
  } catch {
    unmove();
    throw new Error("No se pudieron recuperar los archivos de la papelera");
  }

  const handle = db();
  try {
    handle.transaction(() => {
      for (const { table, rows } of snapshot) {
        if (!TABLES.has(table)) throw new Error(`Tabla no permitida: ${table}`);
        // Columns added or dropped since the delete are tolerated.
        const current = columnsOf(table);
        for (const row of rows) {
          const keys = Object.keys(row).filter((key) => current.has(key));
          handle
            .prepare(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map((k) => `@${k}`).join(", ")})`)
            .run(Object.fromEntries(keys.map((k) => [k, row[k]])));
        }
      }
      handle.prepare("DELETE FROM trash WHERE id = ?").run(id);
    })();
  } catch (error) {
    unmove();
    if ((error as { code?: string }).code?.startsWith("SQLITE_CONSTRAINT")) {
      throw new Error(`No se puede restaurar «${item.label}»: ya existe otro registro con la misma clave`);
    }
    throw error;
  }

  return { entity: item.entity, entityId: item.entity_id, label: item.label, href: hrefFor(item.entity, snapshot) };
}

/** Deletes for good: the snapshot and the trashed files. */
export function purgeFromTrash(id: number): { entity: TrashEntity; entityId: string; label: string } {
  const item = getRaw(id);
  if (!item) throw new Error("No está en la papelera");
  for (const file of JSON.parse(item.files_json) as TrashedFile[]) {
    if (file.stored) fs.rmSync(path.join(trashFilesDir(), path.basename(file.stored)), { force: true });
  }
  db().prepare("DELETE FROM trash WHERE id = ?").run(id);
  return { entity: item.entity, entityId: item.entity_id, label: item.label };
}
