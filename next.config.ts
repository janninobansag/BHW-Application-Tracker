import type { NextConfig } from "next";
import { browserSecurityHeaders, contentSecurityPolicy } from "./Resources/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      ...browserSecurityHeaders,
      { key: "Content-Security-Policy", value: contentSecurityPolicy(undefined, process.env.NODE_ENV === "production") },
      ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=300" }] : []),
    ] }];
  },
  async rewrites() {
    const configured = process.env.RENDER_API_URL || (process.env.NODE_ENV === "development" ? "http://127.0.0.1:10000" : "");
    const apiOrigin = configured.replace(/\/$/, "");
    if (!apiOrigin) return [];
    return [{ source: "/api/backend/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
