import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { deleteSession, deleteUserSessions, findSessionUser, insertSession } from "@/Data/commands";
import type { AppUser } from "@/Data/entities";
export type { AppUser } from "@/Data/entities";
export { hashPassword, validPassword, verifyPassword } from "./password";

const cookieName = process.env.NODE_ENV === "production" ? "__Host-bhw-session" : "bhw-session";
const sessionHours = 12;

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

async function tokenDigest(token: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || token.length > 200) return null;
  const digest = await tokenDigest(token);
  return await findSessionUser(digest, new Date().toISOString());
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
  await insertSession(digest, userId, expiresAt.toISOString());
  (await cookies()).set(cookieName, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
    path: "/", expires: expiresAt,
  });
}

export async function revokeSessions(userId: string): Promise<void> {
  await deleteUserSessions(userId);
}

export async function clearCurrentSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await deleteSession(await tokenDigest(token));
  jar.delete(cookieName);
}
