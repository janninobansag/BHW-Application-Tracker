import test from "node:test";
import assert from "node:assert/strict";
import { cmToFeetInches, feetInchesToCm } from "../public/height-conversion.js";

test("feet and inches convert to centimeters for household storage", () => {
  assert.equal(feetInchesToCm("5", "6"), "167.64");
  assert.equal(feetInchesToCm("5", "6.5"), "168.91");
  assert.equal(feetInchesToCm("", "6"), "");
  assert.equal(feetInchesToCm("5", "12"), "");
  assert.equal(feetInchesToCm("9", "11"), "");
  assert.deepEqual(cmToFeetInches("167.64"), { feet: "5", inches: "6" });
  assert.deepEqual(cmToFeetInches(""), { feet: "", inches: "" });
});
