export function contentSecurityPolicy(nonce?: string, production = false): string {
  return [
    "default-src 'self'",
    nonce ? `script-src 'nonce-${nonce}' 'strict-dynamic' 'report-sample'${production ? "" : " 'unsafe-eval'"}` : "script-src 'self' 'report-sample'",
    // The existing component library uses inline styles for popover positioning.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${production ? "" : " ws: wss:"}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "report-uri /api/security-report",
    "report-to csp",
    ...(production ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export const browserSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];
