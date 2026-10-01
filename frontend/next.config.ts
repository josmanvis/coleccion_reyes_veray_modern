import os from "node:os";
import type { NextConfig } from "next";

/**
 * Every address this machine answers on, so the studio can reach CRVMGMT.
 *
 * `next dev` refuses cross-origin requests for its own assets and endpoints
 * unless the origin is listed here. Reaching the app from another computer
 * means arriving as http://192.168.x.x:9182 rather than localhost, so without
 * this the page loads but the sign-in never completes — which looked exactly
 * like the login being broken on the network.
 *
 * Read from the interfaces rather than hard-coded: a laptop gets a different
 * address on a different network, and the private ranges below cover the case
 * where it changes while the server is up. `next start` does not apply this
 * restriction at all, so a packaged build is unaffected either way.
 */
function localOrigins(): string[] {
  const found = Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && !entry.internal)
    .map((entry) => entry!.address);

  return [
    ...new Set([
      ...found,
      "localhost",
      "127.0.0.1",
      // Whatever the router hands out next, and Bonjour names like `imac.local`.
      "192.168.*.*",
      "10.*.*.*",
      "172.16.*.*",
      "172.17.*.*",
      "172.18.*.*",
      "172.19.*.*",
      "172.2*.*.*",
      "172.30.*.*",
      "172.31.*.*",
      "*.local",
    ]),
  ];
}

const nextConfig: NextConfig = {
  allowedDevOrigins: localOrigins(),
  images: {
    // Next 16 defaults images.qualities to [75]. Unlisted values aren't an
    // error — they're silently coerced to the nearest allowed one — so the
    // gallery's quality={85} and the artwork canvas's quality={100} were both
    // being served at 75. List them so the requested quality is honored.
    qualities: [75, 85, 100],
    localPatterns: [
      {
        // The app's own mark, used in the CRVMGMT title bar.
        pathname: "/crv-mark.png",
        search: "",
      },
      {
        pathname: "/wp-content/**",
        search: "",
      },
      {
        pathname: "/wp-content/**",
        search: "?resize=*",
      },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "utfs.io",
      },
      {
        protocol: "https",
        hostname: "i0.wp.com",
      },
    ],
  },
};

export default nextConfig;
