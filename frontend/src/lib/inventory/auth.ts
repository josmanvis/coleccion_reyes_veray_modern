/**
 * Single shared password for the inventory and admin areas.
 * Runs in both the Node and Edge runtimes, so the proxy and the route handlers
 * can derive the same session token.
 */

export const SESSION_COOKIE = "crv_inventory";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export function isConfigured(): boolean {
  return Boolean(process.env.INVENTORY_PASSWORD);
}

export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`crv-inventory-v1:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isValidSession(cookieValue: string | undefined): Promise<boolean> {
  const password = process.env.INVENTORY_PASSWORD;
  if (!password || !cookieValue) return false;
  return constantTimeEqual(cookieValue, await sessionToken(password));
}

export async function isValidPassword(candidate: string): Promise<boolean> {
  const password = process.env.INVENTORY_PASSWORD;
  if (!password) return false;
  return constantTimeEqual(await sessionToken(candidate), await sessionToken(password));
}
