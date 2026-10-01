import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    deviceSizes: [640, 960, 1600],
    imageSizes: [320],
    qualities: [75, 85, 100],
    remotePatterns: [{protocol: "https", hostname: "storage.googleapis.com", pathname: "/gravy-meta-orc-web/**"}],
  },
};
export default nextConfig;
