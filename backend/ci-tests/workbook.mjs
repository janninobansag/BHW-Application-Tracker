import test from "node:test";
import assert from "node:assert/strict";
import { strFromU8, unzipSync } from "fflate";
import { makeWorkbook } from "../src/workbook.ts";
import { makePrintReport } from "../src/print-report.ts";
import { PDFDocument, PrintScaling } from "pdf-lib";

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
  assert.match(styles, /formatCode="mm&quot;\/&quot;dd&quot;\/&quot;yyyy"/);
  assert.match(sheet, /<c r="F7" t="inlineStr" s="6"><is><t xml:space="preserve">M<\/t>/);
});

test("merged table headers have complete borders without internal dividing lines", () => {
  const files = unzipSync(makeWorkbook({ barangay: "Tulay", sitio: "Springwoods", purok: "Hermit Crab", bhw: "Test worker" }, []));
  const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
  const styles = strFromU8(files["xl/styles.xml"]);
  assert.match(sheet, /showGridLines="0"/);
  for (const column of "ABCDEFGHIJK") {
    for (const row of [5, 6]) assert.match(sheet, new RegExp(`<c r="${column}${row}"[ />]`));
  }
  for (const column of "ABCDEK") {
    assert.match(sheet, new RegExp(`<c r="${column}5"[^>]*s="9"`));
    assert.match(sheet, new RegExp(`<c r="${column}6" s="10"/>`));
  }
  for (const column of "GI") assert.match(sheet, new RegExp(`<c r="${column}5"[^>]*s="11"`));
  for (const column of "HJ") assert.match(sheet, new RegExp(`<c r="${column}5" s="12"/>`));
  const borders = styles.match(/<borders[^>]*>(.*?)<\/borders>/)[1].match(/<border>.*?<\/border>/g);
  assert.match(borders[2], /<bottom\/>/);
  assert.match(borders[3], /<top\/>/);
  assert.match(borders[4], /<right\/>/);
  assert.match(borders[5], /<left\/>/);
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

test("printing uses landscape long bond paper and includes every record", () => {
  const heading = { barangay: "Tulay", sitio: "Springwoods", purok: "Hermit Crab", bhw: "Test worker" };
  const row = ["1.", "Test child", 45600, "Hermit Crab", 24, "F", "", "", "", "", "Test guardian"];
  for (const count of [0, 1, 100]) {
    const files = unzipSync(makeWorkbook(heading, Array.from({ length: count }, () => row)));
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
    const workbook = strFromU8(files["xl/workbook.xml"]);
    assert.match(sheet, /<pageSetUpPr fitToPage="1"/);
    assert.match(sheet, /<pageSetup paperSize="14" orientation="landscape" fitToWidth="1" fitToHeight="0" usePrinterDefaults="0"\/>/);
    assert.match(sheet, /<pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35"/);
    assert.ok(workbook.includes(`&apos;Vitamin A and Deworming&apos;!$A$1:$K$${Math.max(6, count + 6)}`));
    assert.match(workbook, /name="_xlnm.Print_Titles" localSheetId="0">&apos;Vitamin A and Deworming&apos;!\$1:\$6<\/definedName>/);
  }
});

test("print-ready PDF preserves long bond page size and paginates records", async () => {
  const heading = { barangay: "Tulay", sitio: "Springwoods", purok: "Hermit Crab", bhw: "Test worker" };
  const row = ["1.", "Test Child Peñalosa", 45599, "Hermit Crab", 24, "F", "", "", "", "", "Test guardian"];
  for (const count of [0, 19, 100]) {
    const bytes = await makePrintReport(heading, Array.from({ length: count }, (_, index) => [String(index + 1), ...row.slice(1)]));
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), count <= 19 ? 1 : 5);
    for (const page of pdf.getPages()) assert.deepEqual(page.getSize(), { width: 936, height: 612 });
    assert.equal(pdf.catalog.getOrCreateViewerPreferences().getPrintScaling(), PrintScaling.None);
  }
});
