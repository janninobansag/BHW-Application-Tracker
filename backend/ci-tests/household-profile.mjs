import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { parseHouseholdProfile } from "../src/household-profile.ts";
import { makeHouseholdProfilePdf } from "../src/household-print.ts";

const sampleMember = () => ({
  id: "member-1", surname: "Sample", firstName: "Child", middleName: "A", relationship: "Head", sex: "F", birthday: "2020-02-29",
  heightCm: "120.5", weightKg: "24", birthPlace: "Minglanilla", classifications: ["AB", "AB", "AB", "AB"],
  religion: "", civilStatus: "", education: "", nipStatus: "", covidStatus: "", profileRemarks: "",
  philhealthId: "", membershipType: "", nutritionStatus: "", sexuallyActive: "na", lastMenstrualPeriod: "",
  familyPlanningMethod: "", cancer: "no", mentalHealth: "no", hypertension: "no", diabetes: "no", tbDots: "no", healthRemarks: "",
});
const sample = () => ({
  barangayId: "barangay-1", purokId: "purok-1", sitioId: "", householdNumber: "Block 1 Lot 1",
  respondent: { surname: "Sample", firstName: "Person", middleName: "" }, respondentRelationship: "Head", visits: ["2026-01-10", "", "", ""],
  nhts: "non-nhts", indigenous: "non-ip", tribe: "", headPhilhealth: "yes", headPhilhealthId: "123", headPhilhealthCategory: "V",
  income: "C", renter: "no", renterMonths: "", waterSource: "level-3", waterSourceOther: "", toiletType: "A", wasteMethod: "D",
  blindDrainage: "no", hazards: ["flood"], hazardOther: "", interviewedBy: "Test worker", reviewedBy: "", encodedBy: "", dateEncoded: "",
  members: [sampleMember()],
});

test("household profile validates location, member details, dates, and measurements", () => {
  const input = sample();
  assert.deepEqual(parseHouseholdProfile(input), input);
  assert.equal(parseHouseholdProfile({ ...input, purokId: "" }), null);
  assert.equal(parseHouseholdProfile({ ...input, visits: ["2026-02-30", "", "", ""] }), null);
  assert.equal(parseHouseholdProfile({ ...input, members: [{ ...sampleMember(), birthday: "2021-02-29" }] }), null);
  assert.equal(parseHouseholdProfile({ ...input, members: [{ ...sampleMember(), weightKg: "24kg" }] }), null);
  assert.equal(parseHouseholdProfile({ ...input, members: Array.from({ length: 11 }, (_, index) => ({ ...sampleMember(), id: `member-${index}` })) }), null);
});

test("household printout has two landscape long-bond pages", async () => {
  const profile = { ...sample(), id: "sample-id", created_by: "worker-id", created_at: "2026-01-10T00:00:00Z", updated_at: "2026-01-10T00:00:00Z", barangay_name: "Sample Barangay", purok_name: "Sample Purok", sitio_name: "" };
  const bytes = await makeHouseholdProfilePdf(profile);
  const document = await PDFDocument.load(bytes);
  assert.equal(document.getPageCount(), 2);
  assert.equal(document.getTitle(), "Household Profile");
  for (const page of document.getPages()) assert.deepEqual(page.getSize(), { width: 1008, height: 612 });
});
