import test from "node:test";
import assert from "node:assert/strict";
import { buildHouseholdSummary } from "../public/household-summary.js";

const member = (id, sex, birthday, classifications, familyPlanningMethod = "") => ({ id, sex, birthday, classifications, familyPlanningMethod, membershipType: "V", religion: "1", education: "EL", civilStatus: "S", cancer: "no", mentalHealth: "no", hypertension: "no", diabetes: "no", tbDots: "no", covidStatus: "F", nipStatus: "", nutritionStatus: "" });
const profile = (id, barangayId, visits, members) => ({ id, barangayId, purokId: `${barangayId}-p`, sitioId: "", visits, members, nhts: "non-nhts", indigenous: "non-ip", renter: "no", income: "C", toiletType: "A", waterSource: "level-3", wasteMethod: "D" });
const fixtures = [
  profile("one", "a", ["2026-01-17", "", "", ""], [member("one-head", "F", "1998-01-01", ["AB WRA", "", "", ""], "P"), member("one-child", "M", "2025-08-01", ["I", "", "", ""])]),
  profile("two", "b", ["2025-01-17", "", "", ""], [member("two-head", "M", "1988-01-01", ["AB", "", "", ""])]),
];

test("household summary totals respect coverage and visit period without double-counting members", () => {
  const all = buildHouseholdSummary(fixtures, { today: "2026-11-27" });
  assert.equal(all.households, 2);
  assert.equal(all.members, 3);
  assert.equal(all.sections.find((item) => item.title === "4. Sex").items.find((item) => item.label === "Male").value, 2);
  const selected = buildHouseholdSummary(fixtures, { barangayId: "a", year: "2026", quarter: "0", today: "2026-11-27" });
  assert.equal(selected.households, 1);
  assert.equal(selected.members, 2);
  assert.equal(selected.sections.find((item) => item.title === "10. Age and risk classification").items.find((item) => item.label.startsWith("WRA")).value, 1);
  assert.equal(selected.familyPlanning.find((item) => item.label.includes("Pills")).value, 1);
  assert.equal(buildHouseholdSummary(fixtures, { barangayId: "a", year: "2025", today: "2026-11-27" }).households, 0);
});
