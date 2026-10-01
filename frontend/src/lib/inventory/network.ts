/**
 * Telling a request from this machine apart from one off the network.
 *
 * CRVMGMT is reachable from the studio network as a matter of course — the
 * server binds every interface and the sign-in is what keeps strangers out.
 * What this module answers is narrower: *where* a request came from, which
 * decides whether the desktop-only features are on offer and what the history
 * records as the origin of an action.
 *
 * The signal is the Host header — the address the client actually connected
 * to. CRVMGMT's own window loads `localhost`, so anything else arrived over
 * the network. That is a routing fact, not proof of origin: a machine on the
 * LAN can send `Host: localhost` by hand. It is good enough for deciding what
 * to offer, and is never the thing standing between a stranger and the data.
 *
 * No imports on purpose — the proxy, the pages and the route handlers all read
 * it, and it must stay free of anything that drags in the database.
 */

/** Hostnames that only resolve on the machine running CRVMGMT. */
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0", "[::]"]);

/** Strips the port, and the brackets IPv6 authorities carry. */
function hostname(host: string): string {
  const trimmed = host.trim().toLowerCase();
  if (trimmed.startsWith("[")) {
    const close = trimmed.indexOf("]");
    return close === -1 ? trimmed : trimmed.slice(0, close + 1);
  }
  const colon = trimmed.lastIndexOf(":");
  return colon === -1 ? trimmed : trimmed.slice(0, colon);
}

export function isLocalRequest(host: string | null | undefined): boolean {
  if (!host) return true; // No Host header at all: not a browser on the network.
  return LOOPBACK.has(hostname(host));
}

/** A request that arrived over the network rather than from this machine. */
export function isIntranetRequest(host: string | null | undefined): boolean {
  return !isLocalRequest(host);
}

