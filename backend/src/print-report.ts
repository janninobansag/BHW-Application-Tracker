import { readFile } from "node:fs/promises";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PrintScaling, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { REPORT_COLUMN_WIDTHS } from "./workbook.js";
import { REPORT_FONT_SIZES, REPORT_PAGE_MARGINS, REPORT_ROW_HEIGHTS, TIMBANG_COLUMN_WIDTHS, TIMBANG_HEADERS, type ReportHeading, type ReportProgram } from "./report-layout.js";

type ReportRow = Array<string | number>;

// US long bond paper, landscape. Horizontal and vertical margins match Excel.
export const REPORT_PAGE = { width: 936, height: 612, margin: REPORT_PAGE_MARGINS.horizontal * 72, topBottomMargin: REPORT_PAGE_MARGINS.vertical * 72 };
const lineHeight = REPORT_ROW_HEIGHTS.dataLine;
let fonts: Promise<Buffer[]> | undefined;
function fontBytes() {
  return fonts ??= Promise.all(["Regular", "Bold"].map((weight) => readFile(new URL(`../assets/fonts/NotoSans-${weight}.ttf`, import.meta.url))));
}

function wrap(value: string, font: PDFFont, width: number, size: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const char of value.replace(/\s+/g, " ").trim()) {
    if (line && font.widthOfTextAtSize(line + char, size) > width) {
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

function rowHeight(cells: string[][]): number {
  return Math.max(REPORT_ROW_HEIGHTS.dataMinimum, Math.max(...cells.map((lines) => lines.length)) * lineHeight + REPORT_ROW_HEIGHTS.dataPadding);
}

export async function makePrintReport(heading: ReportHeading, records: ReportRow[], program: ReportProgram = "deworming"): Promise<Uint8Array> {
  const timbang = program === "timbang";
  const columnWeights = timbang ? TIMBANG_COLUMN_WIDTHS : REPORT_COLUMN_WIDTHS;
  const title = timbang ? `OPERATION TIMBANG ${heading.year ?? new Date().getFullYear()}` : "VITAMIN A AND DEWORMING";
  const totalColumn = columnWeights.length - 1;
  const document = await PDFDocument.create();
  document.setTitle(timbang ? "Operation Timbang" : "Vitamin A and Deworming");
  document.registerFontkit(fontkit);
  document.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  const [regularBytes, boldBytes] = await fontBytes();
  const regular = await document.embedFont(regularBytes, { subset: true });
  const bold = await document.embedFont(boldBytes, { subset: true });
  // Excel prints the worksheet at fitToWidth=1. Lay out the PDF at worksheet
  // size first, then scale the whole report, including its 13 pt fonts and rows.
  // The workbook's widths use the Arial 11 digit grid (7 px plus 5 px padding).
  const worksheetWidths = columnWeights.map((value) => (Math.floor(value * 7 + 5)) * 72 / 96);
  const worksheetWidth = worksheetWidths.reduce((sum, value) => sum + value, 0);
  const printScale = Math.min(1, (REPORT_PAGE.width - REPORT_PAGE.margin * 2) / worksheetWidth);
  const width = REPORT_PAGE.width / printScale;
  const height = REPORT_PAGE.height / printScale;
  const margin = REPORT_PAGE.margin / printScale;
  const topBottomMargin = REPORT_PAGE.topBottomMargin / printScale;
  const tableWidth = width - margin * 2;
  const widths = worksheetWidths.map((value) => value / worksheetWidth * tableWidth);
  const edges = [margin];
  widths.forEach((value) => edges.push(edges[edges.length - 1] + value));

  const titleBottom = height - topBottomMargin - REPORT_ROW_HEIGHTS.title;
  const metadata = [
    `Barangay: ${heading.barangay}`,
    `Sitio/Purok: ${heading.sitio} / ${heading.purok}`,
    `BHW: ${heading.bhw}`,
  ].map((value) => wrap(value, bold, edges[totalColumn - 1] - margin - 8, REPORT_FONT_SIZES.metadata));
  const metadataHeights = metadata.map((lines) => Math.max(REPORT_ROW_HEIGHTS.metadata, lines.length * lineHeight + REPORT_ROW_HEIGHTS.dataPadding));
  const headerY = titleBottom - metadataHeights.reduce((sum, value) => sum + value, 0);
  const headerHeight = REPORT_ROW_HEIGHTS.headerTop + REPORT_ROW_HEIGHTS.headerBottom;
  const bodyTop = headerY - headerHeight;
  const bodyBottom = topBottomMargin;
  const bodyHeight = bodyTop - bodyBottom;
  const prepared = records.map((row) => {
    const cells = Array.from({ length: widths.length }, (_, column) => {
      const cellPadding = column === 2 ? 1.5 : 4;
      return wrap(column === 2 ? birthdayText(row[column]) : String(row[column] ?? ""), regular, widths[column] - cellPadding * 2, REPORT_FONT_SIZES.body);
    });
    return { cells, height: rowHeight(cells) };
  });
  const pages: Array<typeof prepared> = [[]];
  let used = 0;
  for (const row of prepared) {
    if (used + row.height > bodyHeight && pages[pages.length - 1].length) { pages.push([]); used = 0; }
    pages[pages.length - 1].push(row);
    used += row.height;
  }

  function line(page: PDFPage, x1: number, y1: number, x2: number, y2: number) {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.75, color: rgb(0, 0, 0) });
  }
  function text(page: PDFPage, value: string, x: number, y: number, size: number, font: PDFFont) {
    page.drawText(value, { x, y, size, font, color: rgb(0, 0, 0) });
  }
  function centered(page: PDFPage, value: string, left: number, right: number, y: number, size: number, font: PDFFont) {
    text(page, value, left + (right - left - font.widthOfTextAtSize(value, size)) / 2, y, size, font);
  }
  function drawLines(page: PDFPage, lines: string[], left: number, right: number, bottom: number, cellHeight: number, size: number, font: PDFFont, align: "left" | "center") {
    const leading = Math.max(size + 2, size * 1.15);
    const blockHeight = (lines.length - 1) * leading + size;
    let baseline = bottom + (cellHeight - blockHeight) / 2 + (lines.length - 1) * leading + size * 0.2;
    for (const value of lines) {
      if (align === "center") centered(page, value, left, right, baseline, size, font);
      else text(page, value, left, baseline, size, font);
      baseline -= leading;
    }
  }

  pages.forEach((rows) => {
    const page = document.addPage([REPORT_PAGE.width, REPORT_PAGE.height]);
    drawLines(page, [title], margin, width - margin, titleBottom, REPORT_ROW_HEIGHTS.title, REPORT_FONT_SIZES.title, bold, "center");

    const male = records.filter((row) => row[timbang ? 9 : 5] === "M").length;
    const female = records.filter((row) => row[timbang ? 9 : 5] === "F").length;
    const totals: Array<[string, number]> = [["Male:", male], ["Female:", female], ["Total:", records.length]];
    let metadataTop = titleBottom;
    metadata.forEach((lines, index) => {
      const rowHeight = metadataHeights[index];
      const rowBottom = metadataTop - rowHeight;
      const baseline = rowBottom + (rowHeight - REPORT_FONT_SIZES.metadata) / 2 + REPORT_FONT_SIZES.metadata * 0.2;
      drawLines(page, lines, margin, edges[totalColumn - 1] - 8, rowBottom, rowHeight, REPORT_FONT_SIZES.metadata, bold, "left");
      const [label, count] = totals[index];
      text(page, label, edges[totalColumn] - bold.widthOfTextAtSize(label, REPORT_FONT_SIZES.metadata) - 3, baseline, REPORT_FONT_SIZES.metadata, bold);
      centered(page, String(count), edges[totalColumn], edges[totalColumn + 1], baseline, REPORT_FONT_SIZES.metadata, bold);
      metadataTop = rowBottom;
    });

    const headerDividerY = headerY - REPORT_ROW_HEIGHTS.headerTop;
    line(page, margin, headerY, width - margin, headerY);
    line(page, margin, bodyTop, width - margin, bodyTop);
    if (timbang) {
      edges.forEach((edge) => line(page, edge, headerY, edge, bodyTop));
      TIMBANG_HEADERS.forEach((value, column) => {
        drawLines(page, wrap(value, bold, widths[column] - 2, REPORT_FONT_SIZES.header), edges[column] + 1, edges[column + 1] - 1, bodyTop, headerHeight, REPORT_FONT_SIZES.header, bold, "center");
      });
    } else {
      for (const column of [0, 1, 2, 3, 4, 5, 6, 8, 10, 11]) line(page, edges[column], headerY, edges[column], bodyTop);
      line(page, edges[5], headerDividerY, edges[10], headerDividerY);
      for (const column of [7, 9]) line(page, edges[column], headerDividerY, edges[column], bodyTop);
      const mergedHeaders: Array<[string, number]> = [["NO.", 0], ["NAME", 1], ["DATE OF BIRTH", 2], ["PUROK", 3], ["MONTHS", 4], ["GUARDIAN", 10]];
      mergedHeaders.forEach(([value, column]) => drawLines(page, wrap(value, bold, widths[column] - 2, REPORT_FONT_SIZES.header), edges[column] + 1, edges[column + 1] - 1, bodyTop, headerHeight, REPORT_FONT_SIZES.header, bold, "center"));
      [["Gender", 5, 6], ["Vitamin A", 6, 8], ["Deworming", 8, 10]].forEach(([value, left, right]) => {
        const caption = String(value);
        const firstColumn = Number(left);
        const lastColumn = Number(right);
        drawLines(page, wrap(caption, bold, edges[lastColumn] - edges[firstColumn] - 2, REPORT_FONT_SIZES.header), edges[firstColumn] + 1, edges[lastColumn] - 1, headerDividerY, REPORT_ROW_HEIGHTS.headerTop, REPORT_FONT_SIZES.header, bold, "center");
      });
      drawLines(page, ["M/F"], edges[5], edges[6], bodyTop, REPORT_ROW_HEIGHTS.headerBottom, REPORT_FONT_SIZES.header, bold, "center");
      ["1ST DOSE", "2ND DOSE", "1ST DOSE", "2ND DOSE"].forEach((value, index) => {
        const column = index + 6;
        drawLines(page, wrap(value, bold, widths[column] - 2, REPORT_FONT_SIZES.header), edges[column] + 1, edges[column + 1] - 1, bodyTop, REPORT_ROW_HEIGHTS.headerBottom, REPORT_FONT_SIZES.header, bold, "center");
      });
    }

    let y = bodyTop;
    for (const row of rows) {
      const rowBottom = y - row.height;
      row.cells.forEach((values, column) => {
        const align = (timbang ? [0, 4, 5, 6, 7] : [0, 4, 5]).includes(column) ? "center" : "left";
        const cellPadding = column === 2 ? 1.5 : 4;
        drawLines(page, values, edges[column] + cellPadding, edges[column + 1] - cellPadding, rowBottom, row.height, REPORT_FONT_SIZES.body, regular, align);
      });
      y = rowBottom;
      line(page, margin, y, width - margin, y);
    }
    edges.forEach((edge) => line(page, edge, bodyTop, edge, y));
    page.scaleContent(printScale, printScale);
  });
  return document.save();
}
