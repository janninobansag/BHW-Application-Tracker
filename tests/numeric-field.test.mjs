import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedNumericInput } from "../public/numeric-field.js";

test("household measurements and renting months reject letters and pasted text", () => {
  for (const value of ["12kg", "five", "1e2", "-2", "12,5"]) {
    assert.equal(isAllowedNumericInput(value, "decimal"), false);
    assert.equal(isAllowedNumericInput(value, "numeric"), false);
  }
  assert.equal(isAllowedNumericInput("120.50", "decimal"), true);
  assert.equal(isAllowedNumericInput("1200", "numeric"), true);
  assert.equal(isAllowedNumericInput("120.500", "decimal"), false);
  assert.equal(isAllowedNumericInput("12.5", "numeric"), false);
});
