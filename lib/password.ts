import { argon2id } from "@noble/hashes/argon2.js";

const options = { t: 2, m: 19_456, p: 1, dkLen: 32 } as const;
const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

export function validPassword(password: string): boolean {
  return password.length >= 12 && password.length <= 128;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = argon2id(password, salt, options);
  return `argon2id:19:2:19456:1:${toBase64(salt)}:${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [algorithm, version, time, memory, parallelism, saltValue, hashValue] = stored.split(":");
  if (algorithm !== "argon2id" || version !== "19" || time !== "2" || memory !== "19456" || parallelism !== "1" ||
      !saltValue || !hashValue) return false;
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = fromBase64(saltValue);
    expected = fromBase64(hashValue);
  } catch {
    return false;
  }
  if (salt.length !== 16 || expected.length !== 32) return false;
  const actual = argon2id(password, salt, options);
  let diff = 0;
  for (let index = 0; index < expected.length; index++) diff |= actual[index] ^ expected[index];
  return diff === 0;
}
