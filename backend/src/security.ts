import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { argon2id } from "@noble/hashes/argon2.js";

const argonOptions = { t: 2, m: 19_456, p: 1, dkLen: 32 } as const;
const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
const fromB64 = (value: string) => new Uint8Array(Buffer.from(value, "base64"));

export const sessionCookieName = () => process.env.NODE_ENV === "production" ? "__Host-bhw-session" : "bhw-session";
export const hashSessionToken = (token: string) => {
  const secret = process.env.SESSION_SECRET || (process.env.NODE_ENV !== "production" ? "local-development-session-secret" : "");
  if (!secret) throw new Error("SESSION_SECRET is required to validate sessions.");
  return createHmac("sha256", secret).update(token).digest("hex");
};
export const createSessionToken = () => randomBytes(32).toString("base64url");

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = argon2id(password, salt, argonOptions);
  return `argon2id:19:2:19456:1:${b64(salt)}:${b64(hash)}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [algorithm, version, time, memory, parallelism, saltValue, hashValue] = stored.split(":");
  if (algorithm !== "argon2id" || version !== "19" || time !== "2" || memory !== "19456" || parallelism !== "1" || !saltValue || !hashValue) return false;
  try {
    const salt = fromB64(saltValue);
    const expected = fromB64(hashValue);
    if (salt.length !== 16 || expected.length !== 32) return false;
    const actual = argon2id(password, salt, argonOptions);
    return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  } catch {
    return false;
  }
}

export const validPassword = (password: string) => password.length >= 12 && password.length <= 128;
export const cleanUsername = (value: string) => value.trim().toLowerCase();

export function cookieValue(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=") || null;
  }
  return null;
}
