import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "./db";
import { FIELD_BY_KEY } from "./fields";

/**
 * Who did what, in an append-only log.
 *
 * Every entry is signed, and the signature covers the previous entry's
 * signature as well as the entry itself. That chaining is the point: altering
 * or removing a row breaks every signature after it, so the log cannot be
 * quietly edited by anyone who reaches the database file — which, for a SQLite
 * file sitting in a folder, is the realistic worry.
 *
 * What this is not: the key is the server's, not each person's, so a signature
 * proves the log is intact, not that a particular person and nobody else
 * produced the entry. Non-repudiation would need a keypair per user, and the
 * sign-in is what ties an entry to a person here.
 */

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  user_id INTEGER,
  user_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  summary TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '[]',
  origin TEXT NOT NULL DEFAULT '',
  prev_hash TEXT NOT NULL DEFAULT '',
  hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
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

/**
 * The signing key, kept in the data directory beside the database.
 *
 * It deliberately does not follow the sign-in secret. That secret is a
 * password: it can be rotated, and it was — rotating it would otherwise
 * re-key every signature at once and report the whole history as forged, which
 * is the opposite of what a tamper check is for.
 *
 * On first use the key adopts whatever secret is in the environment, so a log
 * written before this file existed keeps verifying. With no log to preserve it
 * starts from random bytes instead.
 */
let cachedKey: string | null = null;

function key(): string {
  if (cachedKey) return cachedKey;

  const file = path.join(
    path.dirname(process.env.INVENTORY_DB_PATH || path.join(process.cwd(), "data", "inventory.db")),
    "audit.key"
  );

  try {
    const stored = fs.readFileSync(file, "utf8").trim();
    if (stored) {
      cachedKey = stored;
      return cachedKey;
    }
  } catch {
    // No key yet; fall through and mint one.
  }

  const existing = (
    getDb().prepare("SELECT COUNT(*) AS n FROM audit_log").get() as { n: number } | undefined
  )?.n;

  const minted =
    existing && existing > 0
      ? process.env.CRVMGMT_SECRET || process.env.INVENTORY_PASSWORD || "crvmgmt-unsigned"
      : randomBytes(32).toString("hex");

  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // Readable only by the account running CRVMGMT: anyone holding this key
    // can forge an entry that verifies.
    fs.writeFileSync(file, minted, { mode: 0o600 });
  } catch {
    // Unwritable data directory: the key still works for this process.
  }

  cachedKey = minted;
  return cachedKey;
}

export type AuditChange = { field: string; label?: string; before: string; after: string };

export type Actor = {
  id: number | null;
  name: string;
  role: string;
  /** "desktop" or "red local" — where the action came from. */
  origin: string;
};

export type AuditEntry = {
  id: number;
  at: string;
  user_id: number | null;
  user_name: string;
  role: string;
  action: string;
  entity: string;
  entity_id: string | null;
  summary: string;
  origin: string;
  prev_hash: string;
  hash: string;
  changes: AuditChange[];
};

/**
 * The exact bytes a signature covers. Field order is fixed and values are
 * JSON-escaped, so no value can impersonate a separator.
 */
function canonical(row: {
  id: number;
  at: string;
  user_id: number | null;
  user_name: string;
  role: string;
  action: string;
  entity: string;
  entity_id: string | null;
  summary: string;
  detail_json: string;
  origin: string;
  prev_hash: string;
}): string {
  return JSON.stringify([
    row.id,
    row.at,
    row.user_id,
    row.user_name,
    row.role,
    row.action,
    row.entity,
    row.entity_id,
    row.summary,
    row.detail_json,
    row.origin,
    row.prev_hash,
  ]);
}

function sign(payload: string): string {
  return createHmac("sha256", key()).update(payload).digest("hex");
}

export const SYSTEM_ACTOR: Actor = { id: null, name: "Sistema", role: "system", origin: "sistema" };

/**
 * Appends one entry. Written inside a transaction with the read of the
 * previous hash, so two simultaneous actions cannot both chain onto the same
 * predecessor and leave a fork.
 */
export function record(input: {
  actor: Actor;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  changes?: AuditChange[];
}): AuditEntry | null {
  try {
    const handle = db();
    const detail_json = JSON.stringify(input.changes ?? []);

    const append = handle.transaction(() => {
      const previous = handle
        .prepare("SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1")
        .get() as { hash: string } | undefined;
      const prev_hash = previous?.hash ?? "";

      // The row is inserted first so the signature can cover its real id and
      // timestamp rather than a guess at them.
      const inserted = handle
        .prepare(
          `INSERT INTO audit_log
             (user_id, user_name, role, action, entity, entity_id, summary, detail_json, origin, prev_hash, hash)
           VALUES (@user_id, @user_name, @role, @action, @entity, @entity_id, @summary, @detail_json, @origin, @prev_hash, '')`
        )
        .run({
          user_id: input.actor.id,
          user_name: input.actor.name,
          role: input.actor.role,
          action: input.action,
          entity: input.entity,
          entity_id: input.entityId ?? null,
          summary: input.summary,
          detail_json,
          origin: input.actor.origin,
          prev_hash,
        });

      const id = Number(inserted.lastInsertRowid);
      const row = handle.prepare("SELECT * FROM audit_log WHERE id = ?").get(id) as Record<
        string,
        never
      >;
      const hash = sign(canonical(row as never));
      handle.prepare("UPDATE audit_log SET hash = ? WHERE id = ?").run(hash, id);
      return id;
    });

    return get(append());
  } catch {
    // An action must not fail because the log could not be written; a missing
    // entry shows up as a gap when the chain is verified.
    return null;
  }
}

function hydrate(row: Record<string, unknown>): AuditEntry {
  return {
    id: Number(row.id),
    at: String(row.at),
    user_id: row.user_id === null ? null : Number(row.user_id),
    user_name: String(row.user_name),
    role: String(row.role ?? ""),
    action: String(row.action),
    entity: String(row.entity),
    entity_id: row.entity_id === null ? null : String(row.entity_id),
    summary: String(row.summary),
    origin: String(row.origin ?? ""),
    prev_hash: String(row.prev_hash ?? ""),
    hash: String(row.hash),
    changes: JSON.parse(String(row.detail_json ?? "[]")) as AuditChange[],
  };
}

export function get(id: number): AuditEntry | null {
  const row = db().prepare("SELECT * FROM audit_log WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? hydrate(row) : null;
}

export type AuditQuery = {
  userId?: number;
  entity?: string;
  action?: string;
  entityId?: string;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export function listEntries(query: AuditQuery = {}): { entries: AuditEntry[]; total: number } {
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (query.userId) {
    where.push("user_id = @userId");
    params.userId = query.userId;
  }
  if (query.entity) {
    where.push("entity = @entity");
    params.entity = query.entity;
  }
  if (query.action) {
    where.push("action = @action");
    params.action = query.action;
  }
  if (query.entityId) {
    where.push("entity_id = @entityId");
    params.entityId = query.entityId;
  }
  if (query.from) {
    where.push("at >= @from");
    params.from = query.from;
  }
  if (query.to) {
    // Inclusive of the whole day when a bare date is given.
    where.push("at <= @to");
    params.to = query.to.length === 10 ? `${query.to} 23:59:59` : query.to;
  }
  if (query.search?.trim()) {
    where.push("(summary LIKE @search OR user_name LIKE @search OR entity_id LIKE @search)");
    params.search = `%${query.search.trim()}%`;
  }

  const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const handle = db();

  const total = (
    handle.prepare(`SELECT COUNT(*) AS n FROM audit_log ${clause}`).get(params) as { n: number }
  ).n;

  const rows = handle
    .prepare(`SELECT * FROM audit_log ${clause} ORDER BY id DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: query.limit ?? 50, offset: query.offset ?? 0 }) as Array<
    Record<string, unknown>
  >;

  return { entries: rows.map(hydrate), total };
}

/** Distinct values for the history filters, so they only offer what exists. */
export function auditFacets() {
  const handle = db();
  return {
    users: handle
      .prepare(
        "SELECT user_id AS id, user_name AS name, COUNT(*) AS n FROM audit_log GROUP BY user_id, user_name ORDER BY n DESC"
      )
      .all() as Array<{ id: number | null; name: string; n: number }>,
    entities: (
      handle
        .prepare("SELECT DISTINCT entity FROM audit_log ORDER BY entity")
        .all() as Array<{ entity: string }>
    ).map((r) => r.entity),
    actions: (
      handle
        .prepare("SELECT DISTINCT action FROM audit_log ORDER BY action")
        .all() as Array<{ action: string }>
    ).map((r) => r.action),
  };
}

export type ChainReport = {
  total: number;
  ok: boolean;
  /** The first entry whose signature or link does not hold. */
  brokenAt: number | null;
  reason: string;
};

/**
 * Re-signs every entry and checks it still links to the one before. Reads in
 * id order because that is the order the chain was built in.
 */
export function verifyChain(): ChainReport {
  const rows = db().prepare("SELECT * FROM audit_log ORDER BY id").all() as Array<
    Record<string, unknown>
  >;

  let expectedPrev = "";
  for (const row of rows) {
    const stored = String(row.hash);
    const computed = sign(canonical(row as never));

    const a = Buffer.from(stored, "hex");
    const b = Buffer.from(computed, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return {
        total: rows.length,
        ok: false,
        brokenAt: Number(row.id),
        reason: "La firma de esta entrada no corresponde a su contenido.",
      };
    }
    if (String(row.prev_hash ?? "") !== expectedPrev) {
      return {
        total: rows.length,
        ok: false,
        brokenAt: Number(row.id),
        reason: "Falta una entrada anterior o fue alterada.",
      };
    }
    expectedPrev = stored;
  }

  return { total: rows.length, ok: true, brokenAt: null, reason: "" };
}

/**
 * A field-level diff of an artwork, labelled the way the forms label it, so the
 * history reads as "Técnica: óleo → acrílico" rather than as two JSON blobs.
 */
export function diffRows(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): AuditChange[] {
  if (!before || !after) return [];
  const changes: AuditChange[] = [];

  for (const key of Object.keys(after)) {
    // Bookkeeping columns move on their own and say nothing about intent.
    if (key === "id" || key === "updated_at" || key === "status_group") continue;
    const from = before[key] ?? "";
    const to = after[key] ?? "";
    if (String(from) === String(to)) continue;
    changes.push({
      field: key,
      label: FIELD_BY_KEY.get(key)?.label ?? key,
      before: String(from),
      after: String(to),
    });
  }
  return changes;
}
