import { readFile } from "node:fs/promises";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PrintScaling, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { REPORT_COLUMN_WIDTHS } from "./workbook.js";

type Heading = { barangay: string; sitio: string; purok: string; bhw: string };
type ReportRow = Array<string | number>;

// Long bond paper, landscape. Dimensions and margins are in PDF points (72/in).
export const REPORT_PAGE = { width: 936, height: 612, margin: 18 };
const columnWeights = REPORT_COLUMN_WIDTHS;
const fontSize = 8.5;
const lineHeight = 10;
let fonts: Promise<Buffer[]> | undefined;
function fontBytes() {
  return fonts ??= Promise.all(["Regular", "Bold"].map((weight) => readFile(new URL(`../assets/fonts/NotoSans-${weight}.ttf`, import.meta.url))));
}

function wrap(value: string, font: PDFFont, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const char of value.replace(/\s+/g, " ").trim()) {
    if (line && font.widthOfTextAtSize(line + char, fontSize) > width) {
      // Prefer a word boundary, but also allow long unbroken names to wrap.
      const space = line.lastIndexOf(" ");
      if (space > 0) { lines.push(line.slice(0, space)); line = line.slice(space + 1) + char; }
      else { lines.push(line); line = char; }
    } else line += char;
  }
  lines.push(line.trim());
  return lines;
}

function birthdayText(value: string | number): string {
  const date = typeof value === "number" ? new Date(Date.UTC(1899, 11, 30) + value * 86400000).toISOString().slice(0, 10) : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return String(value);
  const [year, month, day] = date.split("-");
  return `${month}/${day}/${year}`;
}

export async function makePrintReport(heading: Heading, records: ReportRow[]): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle("Vitamin A and Deworming");
  document.registerFontkit(fontkit);
  document.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  const [regularBytes, boldBytes] = await fontBytes();
  const regular = await document.embedFont(regularBytes, { subset: true });
  const bold = await document.embedFont(boldBytes, { subset: true });
  const { width, height, margin } = REPORT_PAGE;
  const tableWidth = width - margin * 2;
  const weightTotal = columnWeights.reduce((sum, value) => sum + value, 0);
  const widths = columnWeights.map((value) => value / weightTotal * tableWidth);
  const edges = [margin];
  widths.forEach((value) => edges.push(edges[edges.length - 1] + value));
  const metadata = [
    `Barangay: ${heading.barangay}`,
    `Sitio/Purok: ${heading.sitio} / ${heading.purok}`,
    `BHW: ${heading.bhw}`,
  ].map((value) => wrap(value, bold, edges[9] - margin - 8));
  const metadataHeights = metadata.map((lines) => Math.max(17, lines.length * lineHeight + 5));
  const headerY = height - margin - 30 - metadataHeights.reduce((sum, value) => sum + value, 0);
  const headerHeight = 36;
  const bodyTop = headerY - headerHeight;
  const bodyBottom = margin + 12;
  const bodyHeight = bodyTop - bodyBottom;
  const prepared = records.map((row) => {
    const cells = Array.from({ length: 11 }, (_, column) => wrap(column === 2 ? birthdayText(row[column]) : String(row[column] ?? ""), regular, widths[column] - 8));
    return { cells, height: Math.max(20, Math.max(...cells.map((lines) => lines.length)) * lineHeight + 8) };
  });
  const pages: Array<typeof prepared> = [[]];
  let used = 0;
  for (const row of prepared) {
    if (used + row.height > bodyHeight && pages[pages.length - 1].length) { pages.push([]); used = 0; }
    pages[pages.length - 1].push(row);
    used += row.height;
  }

  function line(page: PDFPage, x1: number, y1: number, x2: number, y2: number) {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.55, color: rgb(0, 0, 0) });
  }
  function text(page: PDFPage, value: string, x: number, y: number, size = fontSize, font = regular) {
    page.drawText(value, { x, y, size, font, color: rgb(0, 0, 0) });
  }
  function centered(page: PDFPage, value: string, left: number, right: number, y: number, size = fontSize, font = bold) {
    text(page, value, left + (right - left - font.widthOfTextAtSize(value, size)) / 2, y, size, font);
  }

  pages.forEach((rows, pageIndex) => {
    const page = document.addPage([width, height]);
    centered(page, "VITAMIN A AND DEWORMING", margin, width - margin, height - margin - 16, 15);
    const male = records.filter((row) => row[5] === "M").length;
    const female = records.filter((row) => row[5] === "F").length;
    const totals: Array<[string, number]> = [["Male:", male], ["Female:", female], ["Total:", records.length]];
    let metadataY = height - margin - 34;
    metadata.forEach((lines, index) => {
      lines.forEach((value, lineIndex) => text(page, value, margin, metadataY - lineIndex * lineHeight, fontSize, bold));
      const [label, count] = totals[index];
      text(page, label, edges[10] - bold.widthOfTextAtSize(label, fontSize) - 3, metadataY, fontSize, bold);
      centered(page, String(count), edges[10], edges[11], metadataY, fontSize, bold);
      metadataY -= metadataHeights[index];
    });

    // Match the Excel export's unfilled, two-level merged table heading.
    line(page, margin, headerY, width - margin, headerY);
    line(page, margin, bodyTop, width - margin, bodyTop);
    for (const column of [0, 1, 2, 3, 4, 5, 6, 8, 10, 11]) line(page, edges[column], headerY, edges[column], bodyTop);
    line(page, edges[5], headerY - 18, edges[10], headerY - 18);
    for (const column of [7, 9]) line(page, edges[column], headerY - 18, edges[column], bodyTop);
    ["NO.", "NAME", "DATE OF BIRTH", "PUROK", "MONTHS"].forEach((value, column) => centered(page, value, edges[column], edges[column + 1], headerY - 21, 8));
    centered(page, "GUARDIAN", edges[10], edges[11], headerY - 21, 8);
    centered(page, "Gender", edges[5], edges[6], headerY - 12, 8);
    centered(page, "M/F", edges[5], edges[6], headerY - 30, 8);
    centered(page, "Vitamin A", edges[6], edges[8], headerY - 12, 8);
    centered(page, "Deworming", edges[8], edges[10], headerY - 12, 8);
    ["1ST DOSE", "2ND DOSE", "1ST DOSE", "2ND DOSE"].forEach((value, index) => centered(page, value, edges[index + 6], edges[index + 7], headerY - 30, 7.5));

    // Fill unused space with ruled rows, rather than stretching text or leaving
    // a large blank area. Extra records continue onto another full-width page.
    let y = bodyTop;
    for (const row of rows) {
      row.cells.forEach((values, column) => values.forEach((value, index) => {
        const baseline = y - (row.height - values.length * lineHeight) / 2 - 8 - index * lineHeight;
        if ([0, 4, 5].includes(column)) centered(page, value, edges[column], edges[column + 1], baseline, fontSize, regular);
        else text(page, value, edges[column] + 4, baseline);
      }));
      y -= row.height;
      line(page, margin, y, width - margin, y);
    }
    while (y - 20 > bodyBottom) { y -= 20; line(page, margin, y, width - margin, y); }
    line(page, margin, bodyBottom, width - margin, bodyBottom);
    edges.forEach((x) => line(page, x, bodyTop, x, bodyBottom));
    text(page, `Page ${pageIndex + 1} of ${pages.length}`, margin, margin - 1, 7);
  });
  return document.save();
}
