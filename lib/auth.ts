import "server-only";
import { env } from "cloudflare:workers";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export type AppUser = {
  id: string;
  username: string;
  display_name: string;
  role: "admin" | "bhw";
  password_hash: string | null;
  is_active: number;
  must_change_password: number;
};

const cookieName = process.env.NODE_ENV === "production" ? "__Host-bhw-session" : "bhw-session";
const sessionHours = 12;

export function db(): D1Database {
  if (!env.DB) throw new Error("D1 database is unavailable");
  return env.DB;
}

export function cleanUsername(value: string): string {
  return value.trim().toLowerCase();
}

export async function assertSameOrigin(): Promise<void> {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const host = requestHeaders.get("host");
  if (!origin || !host || new URL(origin).host !== host) throw new Error("Invalid request origin");
}

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const hash = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 600_000 }, key, 256));
  return `pbkdf2:600000:${toBase64(salt)}:${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [algorithm, count, saltValue, hashValue] = stored.split(":");
  if (algorithm !== "pbkdf2" || !saltValue || !hashValue) return false;
  const iterations = Number(count);
  if (iterations < 600_000 || iterations > 2_000_000) return false;
  const expected = fromBase64(hashValue);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const actual = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromBase64(saltValue), iterations }, key, expected.length * 8));
  let diff = 0;
  for (let index = 0; index < expected.length; index++) diff |= actual[index] ^ expected[index];
  return diff === 0;
}

export function validPassword(password: string): boolean {
  return password.length >= 12 && password.length <= 128;
}

async function tokenDigest(token: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || token.length > 200) return null;
  const digest = await tokenDigest(token);
  const user = await db().prepare(`SELECT u.id, u.username, u.display_name, u.role, u.password_hash,
    u.is_active, u.must_change_password FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.is_active = 1`).bind(digest, new Date().toISOString()).first<AppUser>();
  return user ?? null;
}

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.must_change_password) redirect("/password");
  return user;
}

export async function requireAdmin(): Promise<AppUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

export async function createSession(userId: string): Promise<void> {
  const token = toBase64(crypto.getRandomValues(new Uint8Array(32))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const digest = await tokenDigest(token);
  const expiresAt = new Date(Date.now() + sessionHours * 60 * 60 * 1000);
  await db().prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(digest, userId, expiresAt.toISOString()).run();
  (await cookies()).set(cookieName, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
    path: "/", expires: expiresAt,
  });
}

export async function revokeSessions(userId: string): Promise<void> {
  await db().prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
}

export async function clearCurrentSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await db().prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await tokenDigest(token)).run();
  jar.delete(cookieName);
}
