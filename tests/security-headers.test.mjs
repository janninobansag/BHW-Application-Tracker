import test from "node:test";
import assert from "node:assert/strict";
import { contentSecurityPolicy, browserSecurityHeaders } from "../Resources/security-headers.ts";
import { POST } from "../app/api/security-report/route.ts";

test("production scripts require a per-response nonce, with no inline or eval escape", () => {
  const policy = contentSecurityPolicy("randomNonce", true);
  const script = policy.split("; ").find((directive) => directive.startsWith("script-src "));
  assert.match(script, /'nonce-randomNonce' 'strict-dynamic'/);
  assert.doesNotMatch(script, /unsafe-inline|unsafe-eval/);
  assert.match(policy, /worker-src 'self'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /form-action 'self'/);
  assert.match(policy, /report-uri \/api\/security-report/);
  assert.match(contentSecurityPolicy("development", false), /unsafe-eval/);
  assert.doesNotMatch(contentSecurityPolicy(undefined, true), /nonce-|unsafe-eval|script-src 'unsafe-inline'/);
  assert.ok(browserSecurityHeaders.some(({ key, value }) => key === "Referrer-Policy" && value === "no-referrer"));
});

test("CSP reporting omits sensitive fields and limits input size", async () => {
  const request = (payload) => new Request("https://bhw.example/api/security-report", { method: "POST", headers: { "content-type": "application/csp-report" }, body: JSON.stringify(payload) });
  const previousWarn = console.warn;
  const logs = [];
  console.warn = (...args) => logs.push(args);
  try {
    assert.equal((await POST(request({ "csp-report": { "effective-directive": "script-src-elem", "document-uri": "https://bhw.example/?private=secret", "script-sample": "child details", "blocked-uri": "https://attacker.example" } }))).status, 204);
    assert.deepEqual(logs, [["CSP violation counts", { "script-src-elem": 1 }]]);
    assert.equal((await POST(request({ "csp-report": { "effective-directive": "attacker log injection" } }))).status, 204);
    assert.equal(logs.length, 1);
    assert.equal((await POST(request({ large: "x".repeat(9000) }))).status, 413);
  } finally { console.warn = previousWarn; }
});
