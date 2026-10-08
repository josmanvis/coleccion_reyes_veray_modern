/**
 * Signed session tokens.
 *
 * Kept free of Node APIs so the proxy (Edge runtime) and the route handlers
 * (Node) can verify the same token with Web Crypto.
 */

export const SESSION_COOKIE = "crvmgmt_session";
export const SESSION_MAX_AGE = 60 * 60 * 12;

export type SessionClaims = { userId: number; role: string; expiresAt: number; version: number };

function secret(): string {
  return process.env.CRVMGMT_SECRET || process.env.INVENTORY_PASSWORD || "";
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSession(userId: number, role: string, version = 0): Promise<string> {
  const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${userId}.${role}.${expiresAt}.${version}`;
  return `${payload}.${await sign(payload)}`;
}

export async function readSession(token: string | undefined, current?: (id: number) => Promise<{active: number; role: string; session_version: number} | null>): Promise<SessionClaims | null> {
  if (!token || !secret()) return null;
  const parts = token.split(".");
  if (parts.length !== 5) return null;

  const [id, role, expiry, version, signature] = parts;
  const payload = `${id}.${role}.${expiry}.${version}`;
  if (!constantTimeEqual(signature, await sign(payload))) return null;

  const expiresAt = Number(expiry);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  const userId = Number(id);
  const sessionVersion = Number(version);
  if (!Number.isSafeInteger(userId) || userId < 1 || !Number.isSafeInteger(sessionVersion) || sessionVersion < 0) return null;
  if (current) {
    const user = await current(userId);
    if (!user || user.active !== 1 || user.role !== role || user.session_version !== sessionVersion) return null;
  }
  return { userId, role, expiresAt, version: sessionVersion };
}

export const ROLES = ["superadmin", "admin", "staff"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Superadministrador",
  admin: "Administrador",
  staff: "Personal",
};

/** Who may create users and reset passwords. */
export function canManageUsers(role: string): boolean {
  return role === "superadmin" || role === "admin";
}
