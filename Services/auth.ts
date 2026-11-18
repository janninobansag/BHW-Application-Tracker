import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { backendRequest } from "@/Data/api-client";
import type { AppUser } from "@/Data/entities";
export type { AppUser } from "@/Data/entities";

const cookieName = process.env.NODE_ENV === "production" ? "__Host-bhw-session" : "bhw-session";

export function cleanUsername(value: string): string { return value.trim().toLowerCase(); }

export async function assertSameOrigin(): Promise<void> {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const host = requestHeaders.get("host");
  if (!origin || !host || new URL(origin).host !== host) throw new Error("Invalid request origin");
}

export async function getCurrentUser(): Promise<AppUser | null> {
  try {
    const response = await backendRequest("/auth/me");
    if (!response.ok) return null;
    const payload = await response.json() as { user: AppUser };
    return payload.user;
  } catch {
    return null;
  }
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

export async function isSetupComplete(): Promise<boolean> {
  try {
    const response = await backendRequest("/auth/setup-status");
    if (!response.ok) return false;
    return (await response.json() as { complete: boolean }).complete;
  } catch {
    return false;
  }
}

export async function clearLocalSession(): Promise<void> {
  (await cookies()).set(cookieName, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
}
