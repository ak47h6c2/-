import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@careerpilot/shared"],
  devIndicators: false
};

export default nextConfig;
