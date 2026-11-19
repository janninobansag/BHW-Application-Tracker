import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { contentSecurityPolicy } from "./Resources/security-headers";

export function proxy(request: NextRequest) {
  const nonce = randomBytes(24).toString("base64");
  const policy = contentSecurityPolicy(nonce, process.env.NODE_ENV === "production");
  const headers = new Headers(request.headers);
  // Overwrite any client-supplied nonce/policy before Next.js renders scripts.
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Reporting-Endpoints", `csp="${new URL("/api/security-report", request.url).href}"`);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!api/|_next/|.*\\.).*)"],
};
