import test from "node:test";
import assert from "node:assert/strict";
import { ageInMonths, isValidBirthday, makeCsv, todayInManila } from "../Services/child-records.ts";

test("completed months use the Philippine calendar date", () => {
  assert.equal(ageInMonths("2022-02-02", "2026-11-17"), 57);
  assert.equal(ageInMonths("2022-02-18", "2026-11-17"), 56);
  assert.equal(ageInMonths("2026-11-17", "2026-11-17"), 0);
  assert.equal(ageInMonths("2024-02-29", "2025-02-28"), 11);
  assert.equal(todayInManila(new Date("2026-11-16T16:30:00Z")), "2026-11-17");
});

test("invalid and future birthdays are rejected", () => {
  assert.equal(isValidBirthday("2025-02-29", "2026-11-17"), false);
  assert.equal(isValidBirthday("2026-11-18", "2026-11-17"), false);
  assert.equal(isValidBirthday("2022-02-02", "2026-11-17"), true);
});

test("CSV quotes fields and neutralizes spreadsheet formulas", () => {
  assert.equal(makeCsv([["Name", "Parents"], ["Ana, Jr.", '=HYPERLINK("bad")']]),
    '\uFEFF"Name","Parents"\r\n"Ana, Jr.","\'=HYPERLINK(""bad"")"\r\n');
});
