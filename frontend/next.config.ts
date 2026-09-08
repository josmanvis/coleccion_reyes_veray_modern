import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Next 16 defaults images.qualities to [75]. Unlisted values aren't an
    // error — they're silently coerced to the nearest allowed one — so the
    // gallery's quality={85} and the artwork canvas's quality={100} were both
    // being served at 75. List them so the requested quality is honored.
    qualities: [75, 85, 100],
    localPatterns: [
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
