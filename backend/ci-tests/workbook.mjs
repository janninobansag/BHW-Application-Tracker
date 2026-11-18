import test from "node:test";
import assert from "node:assert/strict";
import { strFromU8, unzipSync } from "fflate";
import { makeWorkbook } from "../src/workbook.ts";

test("formatted workbook includes the requested headings, layout, and totals", () => {
  const workbook = makeWorkbook(
    { barangay: "Tulay", sitio: "Springwoods", purok: "Hermit Crab", bhw: "Jonalyn Bansag" },
    [
      ["1.", "Agustin Clement C. Jaictin", 45600, "Hermit Crab", 24, "M", "", "", "", "", "Marchel C. Jaictin"],
      ["2.", "Apphia Maria Namoc", 45700, "Hermit Crab", 19, "F", "", "", "", "", "Nicole Ann Marie P. Namoc"],
      ["3.", "Charlotte Celeste L. Cabrera", 45900, "Hermit Crab", 24, "F", "", "", "", "", "Rhyza L. Cabrera"],
    ],
  );

  const files = unzipSync(workbook);
  const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
  const styles = strFromU8(files["xl/styles.xml"]);

  assert.match(sheet, /<t xml:space="preserve">VITAMIN A AND DEWORMING<\/t>/);
  assert.match(sheet, /<t xml:space="preserve">Barangay: Tulay<\/t>/);
  assert.match(sheet, /<t xml:space="preserve">Sitio\/Purok: Springwoods \/ Hermit Crab<\/t>/);
  assert.match(sheet, /<t xml:space="preserve">BHW: Jon(?:al|a)yn Bansag<\/t>/);
  assert.match(sheet, /<mergeCell ref="A1:K1"\/>/);
  assert.match(sheet, /<pane ySplit="6" topLeftCell="A7"[^>]*state="frozen"\/>/);
  assert.match(sheet, /<t xml:space="preserve">DATE OF BIRTH<\/t>/);
  assert.match(sheet, /<t xml:space="preserve">MONTHS<\/t>/);
  assert.match(sheet, /<t xml:space="preserve">GUARDIAN<\/t>/);
  assert.match(sheet, /<f>COUNTIF\(F7:F9,&quot;M&quot;\)<\/f><v>1<\/v>/);
  assert.match(sheet, /<f>COUNTIF\(F7:F9,&quot;F&quot;\)<\/f><v>2<\/v>/);
  assert.match(sheet, /<f>COUNTA\(B7:B9\)<\/f><v>3<\/v>/);
  assert.match(sheet, /<c r="C7" s="5"><v>45600<\/v><\/c>/);
  assert.match(styles, /formatCode="mm\/dd\/yyyy"/);
  assert.match(sheet, /<c r="F7" t="inlineStr" s="6"><is><t xml:space="preserve">M<\/t>/);
});

test("workbook escapes user-provided cell text", () => {
  const workbook = makeWorkbook(
    { barangay: "Tulay & Tipay", sitio: "North <Block>", purok: "Hermit Crab", bhw: "Jonalyn Bansag" },
    [["1.", "Ana & Jr.", 45600, "Hermit Crab", 24, "F", "", "", "", "", "<Guardian>"]],
  );
  const sheet = strFromU8(unzipSync(workbook)["xl/worksheets/sheet1.xml"]);

  assert.match(sheet, /Barangay: Tulay &amp; Tipay/);
  assert.match(sheet, /Sitio\/Purok: North &lt;Block&gt; \/ Hermit Crab/);
  assert.match(sheet, /Ana &amp; Jr\./);
  assert.match(sheet, /&lt;Guardian&gt;/);
});
