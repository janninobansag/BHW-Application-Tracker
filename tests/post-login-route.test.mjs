import test from "node:test";
import assert from "node:assert/strict";
import { postLoginRoute } from "../Services/post-login-route.ts";

test("signed-in workers and admins start at the dashboard", () => {
  assert.equal(postLoginRoute({ must_change_password: 0 }), "/dashboard");
});

test("temporary-password accounts must change their password before the dashboard", () => {
  assert.equal(postLoginRoute({ must_change_password: 1 }), "/password");
});
