import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, validPassword } from "../password.ts";

test("Argon2id hashes verify without storing the password", async () => {
  const hash = await hashPassword("LocalTestPass!2026");
  assert.match(hash, /^argon2id:19:2:19456:1:/);
  assert.equal(hash.includes("LocalTestPass!2026"), false);
  assert.equal(await verifyPassword("LocalTestPass!2026", hash), true);
  assert.equal(await verifyPassword("wrong password", hash), false);
  assert.equal(await verifyPassword("LocalTestPass!2026", "invalid"), false);
  assert.equal(validPassword("short"), false);
});
