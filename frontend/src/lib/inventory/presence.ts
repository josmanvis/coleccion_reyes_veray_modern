import { getDb } from "./db";

/**
 * Who is in CRVMGMT right now.
 *
 * Each open tab sends a heartbeat carrying the state its own browser observed —
 * typing and clicking means active, a couple of quiet minutes means idle, a
 * hidden tab means away. The server only decides when someone has *gone*: a
 * heartbeat that stops arriving is a closed laptop or a dropped connection, and
 * no "goodbye" message can be relied on for that.
 *
 * One row per tab, not per person, so the same person on the desktop app and a
 * browser counts once in the bar but keeps both sessions honest.
 */

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS presence (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'active',
  page TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL DEFAULT '',
  seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_presence_seen ON presence(seen_at DESC);
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

export type PresenceState = "active" | "idle" | "away";

/** How long after the last heartbeat a tab is treated as gone. */
export const STALE_SECONDS = 75;
/** How often a tab should check in. Well inside STALE_SECONDS. */
export const HEARTBEAT_SECONDS = 25;

export type PresentUser = {
  userId: number;
  name: string;
  accent: string;
  avatar: string | null;
  role: string;
  state: PresenceState;
  page: string;
  origin: string;
  seenAt: string;
  /** Whole seconds since this person's most recent heartbeat. */
  secondsAgo: number;
};

function normalizeState(value: unknown): PresenceState {
  return value === "idle" || value === "away" ? value : "active";
}

export function heartbeat(input: {
  token: string;
  userId: number;
  state: unknown;
  page?: string;
  origin?: string;
}) {
  db()
    .prepare(
      `INSERT INTO presence (token, user_id, state, page, origin, seen_at)
       VALUES (@token, @user_id, @state, @page, @origin, datetime('now'))
       ON CONFLICT(token) DO UPDATE SET
         user_id = @user_id, state = @state, page = @page,
         origin = @origin, seen_at = datetime('now')`
    )
    .run({
      token: input.token,
      user_id: input.userId,
      state: normalizeState(input.state),
      page: (input.page ?? "").slice(0, 120),
      origin: input.origin ?? "",
    });
}

export function leave(token: string) {
  db().prepare("DELETE FROM presence WHERE token = ?").run(token);
}

/** Drops rows nobody will ever claim again. Called on every read. */
function sweep() {
  db()
    .prepare(`DELETE FROM presence WHERE seen_at < datetime('now', '-${STALE_SECONDS * 8} seconds')`)
    .run();
}

/**
 * One entry per person: their liveliest tab wins, because someone typing in one
 * window is present even if another sits idle behind it.
 */
export function present(): PresentUser[] {
  sweep();

  const rows = db()
    .prepare(
      `SELECT p.user_id, p.state, p.page, p.origin, p.seen_at,
              CAST(strftime('%s','now') - strftime('%s', p.seen_at) AS INTEGER) AS seconds_ago,
              u.name, u.accent, u.avatar, u.role
         FROM presence p
         JOIN users u ON u.id = p.user_id
        WHERE p.seen_at >= datetime('now', '-${STALE_SECONDS} seconds')
          AND u.active = 1
        ORDER BY p.seen_at DESC`
    )
    .all() as Array<Record<string, unknown>>;

  const rank: Record<PresenceState, number> = { active: 0, idle: 1, away: 2 };
  const best = new Map<number, PresentUser>();

  for (const row of rows) {
    const entry: PresentUser = {
      userId: Number(row.user_id),
      name: String(row.name),
      accent: String(row.accent ?? ""),
      avatar: row.avatar === null ? null : String(row.avatar),
      role: String(row.role),
      state: normalizeState(row.state),
      page: String(row.page ?? ""),
      origin: String(row.origin ?? ""),
      seenAt: String(row.seen_at),
      secondsAgo: Math.max(0, Number(row.seconds_ago ?? 0)),
    };
    const held = best.get(entry.userId);
    if (!held || rank[entry.state] < rank[held.state]) best.set(entry.userId, entry);
  }

  return [...best.values()].sort(
    (a, b) => rank[a.state] - rank[b.state] || a.name.localeCompare(b.name, "es")
  );
}
