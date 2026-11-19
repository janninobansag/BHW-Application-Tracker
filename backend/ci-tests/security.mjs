import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/app.ts";
import { httpOrigin, validateProductionSecurity } from "../src/request-security.ts";
import { equalSecret } from "../src/security.ts";

let server;
let base;
const previousOrigin = process.env.FRONTEND_ORIGIN;
before(async () => {
  process.env.FRONTEND_ORIGIN = "https://bhw.example";
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (previousOrigin === undefined) delete process.env.FRONTEND_ORIGIN;
  else process.env.FRONTEND_ORIGIN = previousOrigin;
  await new Promise((resolve) => server.close(resolve));
});
const send = (body, headers = {}) => fetch(`${base}/api/children`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

test("rejects foreign, malformed, opaque, and scheme-downgraded origins before authentication", async () => {
  for (const origin of ["https://attacker.example", "https://bhw.example.attacker.example", "http://bhw.example", "null", "invalid", "https://bhw.example/path"]) {
    assert.equal((await send({}, { origin })).status, 403);
  }
  assert.equal((await send({}, { origin: "https://bhw.example" })).status, 401);
  assert.equal((await send({})).status, 401, "originless server actions remain supported");
  assert.equal((await send({}, { "sec-fetch-site": "cross-site" })).status, 403);
});

test("rejects non-JSON, malformed, oversized, deeply nested, and operator-bearing payloads", async () => {
  assert.equal((await send("name=example", { "content-type": "application/x-www-form-urlencoded" })).status, 415);
  assert.equal((await send("{invalid")).status, 400);
  assert.equal((await send({ name: "x".repeat(33_000) })).status, 413);
  for (const body of [{ id: { $ne: null } }, { purokId: [] }, { barangayId: 42 }, { id: "" , name: {} }, { active: "false" }, { nested: { "__proto__": null, "$where": "anything" } }, { nested: JSON.parse('{"__proto__":{"polluted":true}}') }]) {
    assert.equal((await send(body)).status, 400);
  }
  let nested = {};
  for (let i = 0; i < 12; i++) nested = { nested };
  assert.equal((await send(nested)).status, 400);
});

test("private and error responses carry no-store and browser isolation headers", async () => {
  const response = await send({}, { origin: "null" });
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-powered-by"), null);
});

test("production rejects placeholder secrets and missing or invalid frontend origins", () => {
  const env = { NODE_ENV: "production", SESSION_SECRET: "a".repeat(48), FRONTEND_ORIGIN: "https://bhw.example", ADMIN_SETUP_TOKEN: "b".repeat(48) };
  assert.doesNotThrow(() => validateProductionSecurity(env));
  assert.doesNotThrow(() => validateProductionSecurity({ ...env, ADMIN_SETUP_TOKEN: undefined }));
  for (const changes of [{ SESSION_SECRET: "short" }, { SESSION_SECRET: "change-".padEnd(48, "x") }, { FRONTEND_ORIGIN: "" }, { FRONTEND_ORIGIN: "http://bhw.example" }, { FRONTEND_ORIGIN: "https://bhw.example/path" }, { ADMIN_SETUP_TOKEN: "short" }]) {
    assert.throws(() => validateProductionSecurity({ ...env, ...changes }));
  }
  assert.equal(httpOrigin("https://bhw.example:443/"), "https://bhw.example");
  assert.equal(httpOrigin("https://user@bhw.example"), null);
  assert.equal(equalSecret("correct", "correct"), true);
  assert.equal(equalSecret("wrong", "correct"), false);
  assert.equal(equalSecret({}, "correct"), false);
});
