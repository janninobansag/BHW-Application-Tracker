import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const configured = process.env.RENDER_API_URL || (process.env.NODE_ENV === "development" ? "http://127.0.0.1:10000" : "");
    const apiOrigin = configured.replace(/\/$/, "");
    if (!apiOrigin) return [];
    return [{ source: "/api/backend/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
