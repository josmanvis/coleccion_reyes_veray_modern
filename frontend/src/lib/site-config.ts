/**
 * Whether the public website is served.
 *
 * Turned off for now: CRVMGMT is the only thing in use, and leaving the public
 * pages reachable invites someone to land on a half-finished site. The routes
 * stay in the codebase — nothing is deleted — so flipping this back on brings
 * them straight back.
 *
 * No imports, so the proxy (Edge) and the pages (Node) can both read it.
 */
export const PUBLIC_SITE_ENABLED = process.env.PUBLIC_SITE_ENABLED === "true";

/** Where someone landing on a disabled public route is sent. */
export const HOME_PATH = "/inventory";

/** Paths that must stay reachable without a session. */
const ALWAYS_OPEN = ["/login", "/api/auth"];

export function isAlwaysOpen(pathname: string): boolean {
  return ALWAYS_OPEN.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** The admin surface, which is what the proxy guards. */
export function isManagementPath(pathname: string): boolean {
  return (
    pathname === HOME_PATH ||
    pathname.startsWith("/inventory/") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/inventory") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/presence") ||
    pathname.startsWith("/api/me") ||
    pathname.startsWith("/api/timeclock")
  );
}
