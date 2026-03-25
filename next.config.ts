import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Keep local linting, but don't block production builds on existing lint backlog.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
