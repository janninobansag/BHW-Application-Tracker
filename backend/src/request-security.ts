import type { NextFunction, Request, Response } from "express";
import { getDb } from "./db.js";
import { hashSessionToken } from "./security.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const deny = (res: Response, status: number, message: string) => res.status(status).json({ message });

export function httpOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && url.origin !== "null" && url.pathname === "/" && !url.search && !url.hash ? url.origin : null;
  } catch { return null; }
}

export function validateProductionSecurity(env = process.env): void {
  if (env.NODE_ENV !== "production") return;
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32 || /^(change-|local-development)/i.test(env.SESSION_SECRET)) throw new Error("Set SESSION_SECRET to a random secret of at least 32 characters.");
  const origin = env.FRONTEND_ORIGIN && httpOrigin(env.FRONTEND_ORIGIN);
  if (!origin?.startsWith("https://")) throw new Error("Set FRONTEND_ORIGIN to the exact HTTPS frontend origin.");
  if (env.ADMIN_SETUP_TOKEN && (env.ADMIN_SETUP_TOKEN.length < 32 || /^change-/i.test(env.ADMIN_SETUP_TOKEN))) throw new Error("Use a random ADMIN_SETUP_TOKEN of at least 32 characters, or remove it after setup.");
}

export function responseSecurity(_req: Request, res: Response, next: NextFunction) {
  res.set({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-origin",
  });
  res.vary("Sec-Fetch-Site");
  return next();
}

export function browserRequestSecurity(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api/")) return next();
  // No direct cross-origin browser integration is used: Vercel proxies requests.
  if (req.get("sec-fetch-site") === "cross-site") return deny(res, 403, "Invalid request origin.");
  if (safeMethods.has(req.method)) return next();
  const origin = req.get("origin");
  if (origin) {
    const expected = process.env.FRONTEND_ORIGIN || (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
    if (!httpOrigin(origin) || httpOrigin(origin) !== httpOrigin(expected)) return deny(res, 403, "Invalid request origin.");
  }
  // Originless server actions are allowed. Simple cross-site forms cannot send JSON.
  if (!req.is("application/json")) return deny(res, 415, "Send requests as application/json.");
  return next();
}

export function validId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 160 && /^[a-zA-Z0-9_-]+$/.test(value);
}

function safeJson(value: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (Array.isArray(value)) return value.length <= 500 && value.every((item) => safeJson(item, depth + 1));
  if (value && typeof value === "object") return Object.entries(value).every(([key, item]) => !key.startsWith("$") && !key.includes(".") && !["__proto__", "prototype", "constructor"].includes(key) && safeJson(item, depth + 1));
  return true;
}

export function validateJsonRequest(req: Request, res: Response, next: NextFunction) {
  if (safeMethods.has(req.method) || !req.path.startsWith("/api/")) return next();
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) || !safeJson(req.body)) return deny(res, 400, "Invalid request data.");
  for (const key of ["id", "barangayId", "purokId", "offlineUserId"]) {
    if (req.body[key] !== undefined && req.body[key] !== "" && !validId(req.body[key])) return deny(res, 400, "Invalid record or location ID.");
  }
  for (const key of ["barangayIds", "purokIds"]) {
    // Server forms send a single checkbox value as a string.
    const value = req.body[key];
    if (value !== undefined && !(Array.isArray(value) ? value.every(validId) : value === "" || validId(value))) return deny(res, 400, "Invalid assignment IDs.");
  }
  for (const key of ["username", "password", "current", "next", "confirm", "temporaryPassword", "setupToken", "name", "givenName", "firstName", "middleInitial", "surname", "parents", "displayName"]) {
    if (req.body[key] !== undefined && typeof req.body[key] !== "string") return deny(res, 400, "Invalid text field.");
  }
  if (req.body.active !== undefined && typeof req.body.active !== "boolean") return deny(res, 400, "Invalid account state.");
  return next();
}

type Limit = { _id: string; count: number; expires_at: Date };

// MongoDB counters are atomic and survive restarts and multiple API instances.
export async function consumeLimit(scope: string, subject: string, maximum: number, windowMs: number, at = Date.now()): Promise<number> {
  const window = Math.floor(at / windowMs);
  const expires = new Date((window + 1) * windowMs);
  const key = hashSessionToken(`limit:${scope}:${subject}:${window}`);
  const limits = (await getDb()).collection<Limit>("security_limits");
  let result;
  try {
    result = await limits.findOneAndUpdate({ _id: key }, { $inc: { count: 1 }, $setOnInsert: { expires_at: expires } }, { upsert: true, returnDocument: "after" });
  } catch (error) {
    // A concurrent first upsert may win the unique _id insertion.
    if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error;
    result = await limits.findOneAndUpdate({ _id: key }, { $inc: { count: 1 } }, { returnDocument: "after" });
  }
  if (!result || result.count > maximum) return Math.max(1, Math.ceil((expires.getTime() - at) / 1000));
  return 0;
}

export function authRateLimit(scope: string, maximum: number, windowMs: number, subject: (req: Request, res: Response) => string = () => "all") {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const retry = await consumeLimit(scope, subject(req, res), maximum, windowMs);
      if (retry) { res.set("Retry-After", String(retry)); return deny(res, 429, "Too many attempts. Try again later."); }
      return next();
    } catch (error) { return next(error); }
  };
}
