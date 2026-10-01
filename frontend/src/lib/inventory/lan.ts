import os from "node:os";

/**
 * The addresses another machine would type. Only IPv4 and only real interfaces:
 * loopback is what this machine already uses, and an IPv6 link-local address is
 * not something anyone is going to key into a browser.
 */
export function networkAddresses(port: string): string[] {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === "IPv4" && !entry.internal)
    .map((entry) => `http://${entry!.address}:${port}`);
}

/** The port this request came in on, for building addresses that reach the same server. */
export function portOf(host: string): string {
  return host.includes(":") ? host.slice(host.lastIndexOf(":") + 1) : "9182";
}
