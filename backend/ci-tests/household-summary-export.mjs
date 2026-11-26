import test from "node:test";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import { PDFDocument } from "pdf-lib";
import { makeHouseholdSummaryPdf, makeHouseholdSummaryWorkbook } from "../src/household-summary-export.ts";

const heading = { barangay: "Tulay", purok: "Tipay", sitio: "Springwoods", worker: "Jonalyn Bansag", year: "2026", quarter: "1st", today: "2026-11-27" };
const filters = { barangayId: "barangay-1", purokId: "purok-1", sitioId: "sitio-1", year: "2026", quarter: "0" };
const member = {
  surname: "Sample", firstName: "Child", middleName: "A", sex: "F", birthday: "2020-02-29", classifications: ["AB", "", "", ""],
  relationship: "Head", religion: "1", civilStatus: "S", education: "EL", nipStatus: "", covidStatus: "F", membershipType: "V",
  nutritionStatus: "", familyPlanningMethod: "", cancer: "no", mentalHealth: "no", hypertension: "no", diabetes: "no", tbDots: "no",
};
const profile = {
  id: "house-1", barangayId: "barangay-1", purokId: "purok-1", sitioId: "sitio-1", visits: ["2026-01-12", "", "", ""], members: [member],
  nhts: "non-nhts", indigenous: "non-ip", renter: "no", income: "C", toiletType: "A", waterSource: "level-3", wasteMethod: "D",
};

test("household summary exports use the same filtered counts and two legal landscape pages", async () => {
  const profiles = [profile, { ...profile, id: "outside", purokId: "other" }];
  const workbook = unzipSync(makeHouseholdSummaryWorkbook(profiles, heading, filters));
  const first = strFromU8(workbook["xl/worksheets/sheet1.xml"]);
  const second = strFromU8(workbook["xl/worksheets/sheet2.xml"]);
  assert.match(first, /1\. Households/);
  assert.match(first, /Tulay/);
  assert.match(first, /12\. Personal\/social history/);
  assert.match(first, /Not collected in the household form/);
  assert.match(first, /<c r="F8" s="5"><v>1<\/v><\/c>/);
  assert.match(second, /18\. Family planning users/);
  assert.match(second, /13\. Cardiovascular risk level/);
  assert.match(second, /21\. Waste segregation/);
  assert.match(first, /paperSize="5" orientation="landscape" fitToWidth="1" fitToHeight="1"/);
  assert.match(strFromU8(workbook["xl/workbook.xml"]), /Page 1/);
  assert.match(strFromU8(workbook["xl/workbook.xml"]), /Page 2/);

  const pdf = await PDFDocument.load(await makeHouseholdSummaryPdf(profiles, heading, filters));
  assert.equal(pdf.getPageCount(), 2);
  for (const page of pdf.getPages()) assert.deepEqual(page.getSize(), { width: 1008, height: 612 });
});
