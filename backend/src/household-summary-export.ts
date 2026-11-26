import { readFile } from "node:fs/promises";
import fontkit from "@pdf-lib/fontkit";
import { zipSync } from "fflate";
import { PDFDocument, PrintScaling, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { buildHouseholdSummary } from "../../public/household-summary.js";
import type { HouseholdProfile } from "./household-profile.js";

export type SummaryHeading = { barangay: string; purok: string; sitio: string; worker: string; year: string; quarter: string; today: string };
type Summary = ReturnType<typeof buildHouseholdSummary>;
type Panel = { title: string; total: number | null; rows: Array<{ label: string; values: number[] }>; matrix?: boolean };
const pageGroups = [
  [[0, 1, 2, 3, 4], [5, 6, 7], [8, 9, 10, "social"]],
  [["risk", 11, 12], [13, 14, 15], ["family", 16, 17, 18]],
] as const;
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const safe = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[character]!));
const column = (index: number): string => index < 26 ? String.fromCharCode(65 + index) : `${column(Math.floor(index / 26) - 1)}${column(index % 26)}`;

function panels(summary: Summary, page: number): Panel[][] {
  return pageGroups[page].map((group) => group.map((index) => {
    if (index === "social" || index === "risk") return { title: index === "social" ? "12. Personal/social history" : "13. Cardiovascular risk level", total: null, rows: [{ label: "Not collected in the household form", values: [] }] };
    return index === "family"
      ? { title: "18. Family planning users", total: summary.familyPlanningTotal, matrix: true, rows: summary.familyPlanning.map((item) => ({ label: item.label, values: [...item.groups, item.value] })) }
      : { title: summary.sections[index].title, total: summary.sections[index].total, rows: summary.sections[index].items.map((item) => ({ label: item.label, values: [item.value] })) };
  }));
}

function reportSummary(profiles: HouseholdProfile[], heading: SummaryHeading, filters: { barangayId: string; purokId: string; sitioId: string; year: string; quarter: string }) {
  return buildHouseholdSummary(profiles, { ...filters, today: heading.today });
}

const black = rgb(0, 0, 0);
function text(page: PDFPage, value: string, x: number, baseline: number, width: number, font: PDFFont, size = 7, align: "left" | "center" | "right" = "left") {
  const content = clean(value);
  let actual = size;
  while (actual > 5.1 && font.widthOfTextAtSize(content, actual) > width) actual -= .2;
  let clipped = content;
  while (clipped && font.widthOfTextAtSize(clipped, actual) > width) clipped = clipped.slice(0, -1);
  const used = font.widthOfTextAtSize(clipped, actual);
  page.drawText(clipped, { x: x + (align === "center" ? (width - used) / 2 : align === "right" ? width - used : 0), y: baseline, size: actual, font, color: black });
}

function drawPanel(page: PDFPage, panel: Panel, x: number, top: number, width: number, regular: PDFFont, bold: PDFFont): number {
  const rowHeight = panel.matrix ? 12.6 : 13;
  const headHeight = 21;
  const matrixHead = panel.matrix ? 16 : 0;
  const height = headHeight + matrixHead + panel.rows.length * rowHeight;
  page.drawRectangle({ x, y: top - height, width, height, borderColor: black, borderWidth: .9 });
  page.drawLine({ start: { x, y: top - headHeight }, end: { x: x + width, y: top - headHeight }, color: black, thickness: .7 });
  text(page, panel.title, x + 5, top - 14, width - 65, bold, 8.2);
  text(page, panel.total === null ? "N/A" : `Total  ${panel.total}`, x + width - 61, top - 14, 55, bold, 7.5, "right");
  const numberX = x + (panel.matrix ? width * .56 : width - 41);
  page.drawLine({ start: { x: numberX, y: top - headHeight }, end: { x: numberX, y: top - height }, color: black, thickness: .55 });
  if (panel.matrix) {
    const labels = ["Method", "10-14", "15-19", "20-49", "Total"];
    const starts = [x + 4, numberX, numberX + (width - (numberX - x)) / 4, numberX + (width - (numberX - x)) / 2, numberX + (width - (numberX - x)) * .75];
    const cellWidth = (width - (numberX - x)) / 4;
    labels.forEach((label, index) => text(page, label, starts[index] + (index ? 1 : 0), top - headHeight - 11, index ? cellWidth - 2 : numberX - x - 7, bold, 6.3, index ? "center" : "left"));
    page.drawLine({ start: { x, y: top - headHeight - matrixHead }, end: { x: x + width, y: top - headHeight - matrixHead }, color: black, thickness: .55 });
    for (let i = 1; i < 4; i++) page.drawLine({ start: { x: numberX + i * cellWidth, y: top - headHeight }, end: { x: numberX + i * cellWidth, y: top - height }, color: black, thickness: .45 });
  }
  panel.rows.forEach((row, index) => {
    const rowTop = top - headHeight - matrixHead - index * rowHeight;
    if (index) page.drawLine({ start: { x, y: rowTop }, end: { x: x + width, y: rowTop }, color: black, thickness: .4 });
    text(page, row.label, x + 5, rowTop - 9.2, numberX - x - 9, regular, panel.matrix ? 6.7 : 7.2);
    row.values.forEach((value, valueIndex) => text(page, String(value), numberX + (panel.matrix ? valueIndex * (width - (numberX - x)) / 4 : 0), rowTop - 9.2, panel.matrix ? (width - (numberX - x)) / 4 : 41, regular, 7.2, "center"));
  });
  return top - height - 9;
}

export async function makeHouseholdSummaryPdf(profiles: HouseholdProfile[], heading: SummaryHeading, filters: { barangayId: string; purokId: string; sitioId: string; year: string; quarter: string }): Promise<Uint8Array> {
  const summary = reportSummary(profiles, heading, filters);
  const document = await PDFDocument.create();
  document.setTitle("Barangay Health Worker Portfolio Summary");
  document.registerFontkit(fontkit);
  document.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  const [regularBytes, boldBytes] = await Promise.all(["Regular", "Bold"].map((weight) => readFile(new URL(`../assets/fonts/NotoSans-${weight}.ttf`, import.meta.url))));
  const regular = await document.embedFont(regularBytes, { subset: true });
  const bold = await document.embedFont(boldBytes, { subset: true });
  for (let pageIndex = 0; pageIndex < 2; pageIndex++) {
    const page = document.addPage([1008, 612]);
    text(page, "MUNICIPALITY OF MINGLANILLA | Municipal Health Office", 20, 585, 968, bold, 10, "center");
    text(page, "BARANGAY HEALTH WORKER PORTFOLIO", 20, 568, 968, bold, 13, "center");
    text(page, "SUMMARY PAGE", 20, 551, 968, bold, 11, "center");
    text(page, `Barangay: ${heading.barangay}`, 24, 526, 330, bold, 8.4);
    text(page, `Purok/Sitio: ${heading.purok} / ${heading.sitio}`, 24, 510, 460, bold, 8.4);
    text(page, `BHW assigned: ${heading.worker}`, 500, 526, 300, bold, 8.4);
    text(page, `Year: ${heading.year}     Quarter: ${heading.quarter}`, 500, 510, 400, bold, 8.4);
    const columns = panels(summary, pageIndex);
    columns.forEach((group, index) => { let top = 492; for (const panel of group) top = drawPanel(page, panel, 20 + index * 326, top, 316, regular, bold); });
    text(page, "Tally only recorded answers. Some groups overlap. Personal/social history and cardiovascular risk are not collected.", 20, 29, 860, regular, 6.8);
    text(page, `${pageIndex + 1} of 2`, 925, 29, 60, regular, 7, "right");
  }
  return document.save();
}

export function makeHouseholdSummaryWorkbook(profiles: HouseholdProfile[], heading: SummaryHeading, filters: { barangayId: string; purokId: string; sitioId: string; year: string; quarter: string }): Uint8Array {
  const summary = reportSummary(profiles, heading, filters);
  const files: Record<string, string> = {};
  const areas: string[] = [];
  for (let pageIndex = 0; pageIndex < 2; pageIndex++) {
    const cells = new Map<string, string>();
    const merges: string[] = [];
    const put = (col: number, row: number, value: string | number, style: number, span = 1) => {
      const ref = `${column(col)}${row}`;
      cells.set(ref, typeof value === "number" ? `<c r="${ref}" s="${style}"><v>${value}</v></c>` : `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${safe(clean(value))}</t></is></c>`);
      if (span > 1) {
        merges.push(`<mergeCell ref="${ref}:${column(col + span - 1)}${row}"/>`);
        if ([4, 6].includes(style)) for (let index = 1; index < span; index++) {
          const blank = `${column(col + index)}${row}`;
          cells.set(blank, `<c r="${blank}" s="${style}"/>`);
        }
      }
    };
    put(0, 1, "MUNICIPALITY OF MINGLANILLA | Municipal Health Office", 1, 20);
    put(0, 2, "BARANGAY HEALTH WORKER PORTFOLIO", 2, 20);
    put(0, 3, "SUMMARY PAGE", 1, 20);
    put(0, 5, `Barangay: ${heading.barangay}`, 3, 8);
    put(0, 6, `Purok/Sitio: ${heading.purok} / ${heading.sitio}`, 3, 8);
    put(11, 5, `BHW assigned: ${heading.worker}`, 3, 9);
    put(11, 6, `Year: ${heading.year}     Quarter: ${heading.quarter}`, 3, 9);
    const columns = panels(summary, pageIndex);
    let lastRow = 8;
    columns.forEach((group, groupIndex) => {
      const start = groupIndex * 7;
      let row = 8;
      for (const panel of group) {
        put(start, row, panel.title, 4, 5);
        put(start + 5, row, panel.total ?? "N/A", 5);
        row++;
        if (panel.matrix) {
          put(start, row, "Method", 4, 2);
          ["10-14", "15-19", "20-49", "Total"].forEach((label, index) => put(start + index + 2, row, label, 4));
          row++;
        }
        for (const item of panel.rows) {
          put(start, row, item.label, 6, panel.matrix ? 2 : 5);
          item.values.forEach((value, index) => put(start + (panel.matrix ? 2 + index : 5), row, value, 7));
          row++;
        }
        row++;
      }
      lastRow = Math.max(lastRow, row);
    });
    put(0, lastRow + 1, "Tally only recorded answers. Some groups overlap. Personal/social history and cardiovascular risk are not collected.", 8, 20);
    areas.push(`&apos;Page ${pageIndex + 1}&apos;!$A$1:$T$${lastRow + 1}`);
    const rows = Array.from({ length: lastRow + 1 }, (_, index) => {
      const row = index + 1;
      const entries = Array.from({ length: 20 }, (_, col) => cells.get(`${column(col)}${row}`) ?? "").join("");
      return `<row r="${row}" ht="${row <= 3 ? 23 : row <= 6 ? 19 : 15}" customHeight="1">${entries}</row>`;
    }).join("");
    files[`xl/worksheets/sheet${pageIndex + 1}.xml`] = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><cols>${Array.from({ length: 20 }, (_, index) => `<col min="${index + 1}" max="${index + 1}" width="${[6, 11, 11, 11, 11, 8, 2][index % 7]}" customWidth="1"/>`).join("")}</cols><sheetData>${rows}</sheetData><mergeCells count="${merges.length}">${merges.join("")}</mergeCells><printOptions horizontalCentered="1" gridLines="0"/><pageMargins left="0.22" right="0.22" top="0.3" bottom="0.3" header="0.1" footer="0.1"/><pageSetup paperSize="5" orientation="landscape" fitToWidth="1" fitToHeight="1" usePrinterDefaults="0"/></worksheet>`;
  }
  files["[Content_Types].xml"] = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
  files["_rels/.rels"] = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  files["xl/workbook.xml"] = `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Page 1" sheetId="1" r:id="rId1"/><sheet name="Page 2" sheetId="2" r:id="rId2"/></sheets><definedNames>${areas.map((area, index) => `<definedName name="_xlnm.Print_Area" localSheetId="${index}">${area}</definedName>`).join("")}</definedNames></workbook>`;
  files["xl/_rels/workbook.xml.rels"] = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  files["xl/styles.xml"] = `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="12"/><name val="Arial"/></font><font><b/><sz val="15"/><name val="Arial"/></font><font><b/><sz val="9"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`;
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, body]) => [name, new TextEncoder().encode(body)])), { level: 6 });
}
