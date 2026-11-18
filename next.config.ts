import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiOrigin = process.env.RENDER_API_URL?.replace(/\/$/, "");
    if (!apiOrigin) return [];
    return [{ source: "/api/backend/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
