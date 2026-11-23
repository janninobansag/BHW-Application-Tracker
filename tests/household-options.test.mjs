import test from "node:test";
import assert from "node:assert/strict";
import { classificationOptions, civilStatusOptions, covidOptions, educationOptions, incomeOptions, membershipOptions, nipOptions, nutritionOptions } from "../public/household-options.js";

test("household choices show meanings while retaining paper-form codes", () => {
  const groups = [classificationOptions, civilStatusOptions, covidOptions, educationOptions, incomeOptions, membershipOptions, nipOptions, nutritionOptions];
  for (const group of groups) assert.equal(new Set(group.map(([code]) => code)).size, group.length);
  assert.match(classificationOptions.find(([code]) => code === "WRA")?.[1] ?? "", /reproductive age/i);
  assert.match(educationOptions.find(([code]) => code === "JHSC")?.[1] ?? "", /junior high school completer/i);
  assert.match(membershipOptions.find(([code]) => code === "SPWD")?.[1] ?? "", /disability/i);
  assert.match(nutritionOptions.find(([code]) => code === "SAM")?.[1] ?? "", /severely malnourished/i);
  assert.match(nipOptions.find(([code]) => code === "9")?.[1] ?? "", /IPV 1/i);
  assert.match(incomeOptions.find(([code]) => code === "C")?.[1] ?? "", /15,781.*31,560/);
});
