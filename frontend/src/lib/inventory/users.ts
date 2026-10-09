import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "./db";
import { ROLES, type Role } from "./session";

/**
 * User accounts for CRVMGMT.
 *
 * Passwords are stored as scrypt hashes with a per-user salt — never in plain
 * text, and never recoverable. An administrator resets a password rather than
 * reading it, and the person is asked to change it at next sign-in.
 */

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  salt TEXT NOT NULL,
  hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  must_change INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);
`;

/**
 * Columns added after the table already existed in the field. SQLite has no
 * "ADD COLUMN IF NOT EXISTS", so the existing columns are read first — cheaper
 * and clearer than catching the duplicate-column error.
 */
const LATER_COLUMNS: Array<[string, string]> = [
  ["accent", "TEXT NOT NULL DEFAULT ''"],
  ["avatar", "TEXT"],
  ["session_version", "INTEGER NOT NULL DEFAULT 0"],
];

function migrate(handle: ReturnType<typeof getDb>) {
  const existing = new Set(
    (handle.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>).map((c) => c.name)
  );
  for (const [name, definition] of LATER_COLUMNS) {
    if (!existing.has(name)) handle.exec(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
  }
}

let ready = false;

function db() {
  const handle = getDb();
  if (!ready) {
    handle.exec(CREATE_SQL);
    migrate(handle);
    ready = true;
    seedSuperadmin(handle);
  }
  return handle;
}

export type User = {
  id: number;
  session_version: number;
  username: string;
  name: string;
  role: Role;
  active: number;
  must_change: number;
  created_at: string;
  last_login: string | null;
  /** Hex accent this person chose for their own copy of the interface. */
  accent: string;
  /** A small square data URL, or null for initials. */
  avatar: string | null;
};

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

/**
 * The collection's owner always exists. The first run adopts whatever
 * INVENTORY_PASSWORD was already in use, so nobody is locked out by the switch
 * from a single shared password to accounts.
 */
function seedSuperadmin(handle: ReturnType<typeof getDb>) {
  const existing = handle.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (existing.n > 0) return;

  const salt = randomBytes(16).toString("hex");
  const fromEnv = process.env.INVENTORY_PASSWORD;
  const password = fromEnv || randomBytes(9).toString("base64url");

  handle
    .prepare(
      `INSERT INTO users (username, name, role, salt, hash, must_change)
       VALUES ('otto', 'Otto Octavio Reyes Casanova', 'superadmin', ?, ?, ?)`
    )
    .run(salt, hashPassword(password, salt), fromEnv ? 0 : 1);

  if (!fromEnv) {
    // Seeding can happen in a process that never loaded .env.local (a script,
    // a migration). Writing the generated password out is what keeps that from
    // being a lockout — it is the only time it exists in readable form.
    try {
      const file = path.join(process.cwd(), "data", "initial-password.txt");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(
        file,
        `usuario: otto\ncontraseña inicial: ${password}\n\n` +
          `Cámbiala al entrar y borra este archivo.\n`,
        { mode: 0o600 }
      );
    } catch {
      /* nothing writable; the administrator can reset from another account */
    }
  }
}

export function listUsers(): User[] {
  return db()
    .prepare("SELECT id, username, name, role, active, must_change, created_at, last_login, accent, avatar, session_version FROM users ORDER BY id")
    .all() as User[];
}

export function getUser(id: number): User | null {
  return (
    (db()
      .prepare("SELECT id, username, name, role, active, must_change, created_at, last_login, accent, avatar, session_version FROM users WHERE id = ?")
      .get(id) as User) ?? null
  );
}

export function authenticate(username: string, password: string): User | null {
  const row = db()
    .prepare("SELECT * FROM users WHERE lower(username) = lower(?) AND active = 1")
    .get(username.trim()) as (User & { salt: string; hash: string }) | undefined;
  if (!row) return null;

  const attempt = Buffer.from(hashPassword(password, row.salt), "hex");
  const stored = Buffer.from(row.hash, "hex");
  if (attempt.length !== stored.length || !timingSafeEqual(attempt, stored)) return null;

  db().prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(row.id);
  return getUser(row.id);
}

export function createUser(input: {
  username: string;
  name: string;
  role: Role;
  password: string;
}, actorRole: string): User {
  if (!["admin", "superadmin"].includes(actorRole) || (input.role === "superadmin" && actorRole !== "superadmin")) throw new Error("Only the superadministrador may grant that role");
  const username = input.username.trim().toLowerCase();
  if (!username) throw new Error("El usuario es obligatorio");
  if (!input.password || input.password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres");
  }
  if (!ROLES.includes(input.role)) throw new Error("Rol inválido");

  const handle = db();
  if (handle.prepare("SELECT 1 FROM users WHERE lower(username) = ?").get(username)) {
    throw new Error(`El usuario "${username}" ya existe`);
  }

  const salt = randomBytes(16).toString("hex");
  const result = handle
    .prepare(
      `INSERT INTO users (username, name, role, salt, hash, must_change)
       VALUES (@username, @name, @role, @salt, @hash, 1)`
    )
    .run({
      username,
      name: input.name.trim() || username,
      role: input.role,
      salt,
      hash: hashPassword(input.password, salt),
    });

  return getUser(Number(result.lastInsertRowid))!;
}

/** Sets a new password and requires the person to change it when they sign in. */
export function resetPassword(id: number, password: string, actorRole: string): User {
  const target = getUser(id);
  if (!target || !["admin", "superadmin"].includes(actorRole) || (target.role === "superadmin" && actorRole !== "superadmin")) throw new Error("Only the superadministrador may reset that account");
  if (!password || password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres");
  }
  const salt = randomBytes(16).toString("hex");
  db()
    .prepare("UPDATE users SET salt = ?, hash = ?, must_change = 1, session_version = session_version + 1 WHERE id = ?")
    .run(salt, hashPassword(password, salt), id);
  return getUser(id)!;
}

/** Used by the person themselves; clears the change-on-next-login flag. */
export function changeOwnPassword(id: number, current: string, next: string): User {
  const user = getUser(id);
  if (!user) throw new Error("Usuario no encontrado");
  if (!authenticate(user.username, current)) throw new Error("La contraseña actual no es correcta");
  if (!next || next.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");

  const salt = randomBytes(16).toString("hex");
  db()
    .prepare("UPDATE users SET salt = ?, hash = ?, must_change = 0, session_version = session_version + 1 WHERE id = ?")
    .run(salt, hashPassword(next, salt), id);
  return getUser(id)!;
}

export function setActive(id: number, active: boolean): User {
  const user = getUser(id);
  if (!user) throw new Error("Usuario no encontrado");
  if (user.role === "superadmin" && !active) {
    throw new Error("No se puede desactivar al superadministrador");
  }
  db().prepare("UPDATE users SET active = ?, session_version = session_version + 1 WHERE id = ?").run(active ? 1 : 0, id);
  return getUser(id)!;
}

export function setRole(id: number, role: Role, actorRole: string): User {
  const user = getUser(id);
  if (!user) throw new Error("Usuario no encontrado");
  if (user.role === "superadmin" && actorRole !== "superadmin") {
    throw new Error("Solo el superadministrador puede cambiar ese rol");
  }
  if (role === "superadmin" && actorRole !== "superadmin") {
    throw new Error("Solo el superadministrador puede otorgar ese rol");
  }
  db().prepare("UPDATE users SET role = ?, session_version = session_version + 1 WHERE id = ?").run(role, id);
  return getUser(id)!;
}

/**
 * Appearance is the person's own business, so this is the one thing anyone can
 * change about their account without being an administrator.
 *
 * An avatar is stored inline as a data URL. The browser shrinks the picture to
 * a thumbnail before sending it, and the cap here is what stops an unshrunk
 * original from being written into every row that joins this table.
 */
export const MAX_AVATAR_BYTES = 256 * 1024;

export function setAppearance(
  id: number,
  input: { accent?: string; avatar?: string | null }
): User {
  const user = getUser(id);
  if (!user) throw new Error("Usuario no encontrado");

  if (input.accent !== undefined) {
    db().prepare("UPDATE users SET accent = ? WHERE id = ?").run(input.accent, id);
  }

  if (input.avatar !== undefined) {
    const avatar = input.avatar?.trim() || null;
    if (avatar) {
      if (!/^data:image\/(png|jpeg|webp);base64,/.test(avatar)) {
        throw new Error("La imagen debe ser PNG, JPEG o WebP");
      }
      if (avatar.length > MAX_AVATAR_BYTES) {
        throw new Error("La imagen es demasiado grande");
      }
    }
    db().prepare("UPDATE users SET avatar = ? WHERE id = ?").run(avatar, id);
  }

  return getUser(id)!;
}
