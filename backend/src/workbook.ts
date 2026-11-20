import { zipSync } from "fflate";
import { REPORT_FONT_SIZES, REPORT_PAGE_MARGINS, REPORT_ROW_HEIGHTS, TIMBANG_COLUMN_WIDTHS, TIMBANG_HEADERS, type ReportHeading, type ReportProgram } from "./report-layout.js";

type WorkbookHeading = ReportHeading;
export const REPORT_COLUMN_WIDTHS = [7, 30, 19, 24, 16, 14, 18, 18, 20, 20, 32];

const xml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char]!));
const col = (index: number) => String.fromCharCode(65 + index);
const textCell = (ref: string, value: string, style: number) => `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
const numberCell = (ref: string, value: number, style: number) => `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
const formulaCell = (ref: string, formula: string, style: number, cachedValue: number) => `<c r="${ref}" s="${style}"><f>${xml(formula)}</f><v>${cachedValue}</v></c>`;
const blankCell = (ref: string, style: number) => `<c r="${ref}" s="${style}"/>`;

// Keep the column widths based on Arial 11, while making the report text larger.
// Grow wrapped text rows instead of shrinking long child and guardian names.
function recordRowHeight(record: Array<string | number>, widths: number[]): number {
  const lineCounts = widths.map((width, column) => {
    if (column === 2 || typeof record[column] !== "string") return 1;
    const charactersPerLine = Math.max(1, Math.floor((width - 2) * REPORT_FONT_SIZES.widthCalibration / REPORT_FONT_SIZES.body));
    return String(record[column]).split(/\r?\n/).reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0);
  });
  return Math.max(REPORT_ROW_HEIGHTS.dataMinimum, Math.max(...lineCounts) * REPORT_ROW_HEIGHTS.dataLine + REPORT_ROW_HEIGHTS.dataPadding);
}

// Include the perimeter cells of merged headings so Excel mobile and desktop
// draw the same continuous borders without adding lines through merged labels.
const verticalHeaderColumns = new Set([0, 1, 2, 3, 4, 10]);
function headerCell(column: number, row: number, value = "") {
  const style = verticalHeaderColumns.has(column) ? (row === 5 ? 9 : 10)
    : row === 5 ? ([6, 8].includes(column) ? 11 : [7, 9].includes(column) ? 12 : 3) : 3;
  return value ? textCell(`${col(column)}${row}`, value, style) : blankCell(`${col(column)}${row}`, style);
}

export function makeWorkbook(heading: WorkbookHeading, records: Array<Array<string | number>>, program: ReportProgram = "deworming"): Uint8Array {
  const timbang = program === "timbang";
  const widths = timbang ? TIMBANG_COLUMN_WIDTHS : REPORT_COLUMN_WIDTHS;
  const lastColumn = timbang ? "I" : "K";
  const labelColumn = timbang ? "H" : "J";
  const sexColumn = timbang ? "J" : "F";
  const sheetName = timbang ? "Operation Timbang" : "Vitamin A and Deworming";
  const title = timbang ? `OPERATION TIMBANG ${heading.year ?? new Date().getFullYear()}` : "VITAMIN A AND DEWORMING";
  const lastRow = Math.max(7, records.length + 6);
  const printLastRow = Math.max(6, records.length + 6);
  const maleCount = records.filter((record) => record[timbang ? 9 : 5] === "M").length;
  const femaleCount = records.filter((record) => record[timbang ? 9 : 5] === "F").length;
  const dataRows = records.map((record, index) => {
    const rowNumber = index + 7;
    const cells = record.map((value, columnIndex) => {
      const reference = `${col(columnIndex)}${rowNumber}`;
      if (columnIndex === 2 && typeof value === "number") return numberCell(reference, value, 5);
      if ((timbang ? [0, 4, 5, 6, 7] : [0, 4, 5]).includes(columnIndex)) return typeof value === "number"
        ? numberCell(reference, value, 6)
        : textCell(reference, String(value), 6);
      return typeof value === "number" ? numberCell(reference, value, 4) : textCell(reference, String(value), 4);
    }).join("");
    return `<row r="${rowNumber}" ht="${recordRowHeight(record, widths)}" customHeight="1">${cells}</row>`;
  }).join("");

  const rows = [
    `<row r="1" ht="${REPORT_ROW_HEIGHTS.title}" customHeight="1">${textCell("A1", title, 1)}</row>`,
    `<row r="2" ht="${REPORT_ROW_HEIGHTS.metadata}" customHeight="1">${textCell("A2", `Barangay: ${heading.barangay}`, 2)}${textCell(`${labelColumn}2`, "Male:", 7)}${formulaCell(`${lastColumn}2`, `COUNTIF(${sexColumn}7:${sexColumn}${lastRow},\"M\")`, 8, maleCount)}</row>`,
    `<row r="3" ht="${REPORT_ROW_HEIGHTS.metadata}" customHeight="1">${textCell("A3", `Sitio/Purok: ${heading.sitio} / ${heading.purok}`, 2)}${textCell(`${labelColumn}3`, "Female:", 7)}${formulaCell(`${lastColumn}3`, `COUNTIF(${sexColumn}7:${sexColumn}${lastRow},\"F\")`, 8, femaleCount)}</row>`,
    `<row r="4" ht="${REPORT_ROW_HEIGHTS.metadata}" customHeight="1">${textCell("A4", `BHW: ${heading.bhw}`, 2)}${textCell(`${labelColumn}4`, "Total:", 7)}${formulaCell(`${lastColumn}4`, `COUNTA(B7:B${lastRow})`, 8, records.length)}</row>`,
    `<row r="5" ht="${REPORT_ROW_HEIGHTS.headerTop}" customHeight="1">${timbang ? TIMBANG_HEADERS.map((value, column) => textCell(`${col(column)}5`, value, 9)).join("") : ["NO.","NAME","DATE OF BIRTH","PUROK","MONTHS","Gender","Vitamin A","","Deworming","","GUARDIAN"].map((value, column) => headerCell(column, 5, value)).join("")}</row>`,
    `<row r="6" ht="${REPORT_ROW_HEIGHTS.headerBottom}" customHeight="1">${timbang ? TIMBANG_HEADERS.map((_, column) => blankCell(`${col(column)}6`, 10)).join("") : ["","","","","","M/F","1ST DOSE","2ND DOSE","1ST DOSE","2ND DOSE",""].map((value, column) => headerCell(column, 6, value)).join("")}</row>`,
    dataRows,
  ].join("");

  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">&apos;${sheetName}&apos;!$A$1:$${lastColumn}$${printLastRow}</definedName><definedName name="_xlnm.Print_Titles" localSheetId="0">&apos;${sheetName}&apos;!$1:$6</definedName></definedNames><calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="mm&quot;/&quot;dd&quot;/&quot;yyyy"/></numFmts><fonts count="5"><font><sz val="${REPORT_FONT_SIZES.widthCalibration}"/><name val="Arial"/></font><font><b/><sz val="${REPORT_FONT_SIZES.title}"/><name val="Arial"/></font><font><b/><sz val="${REPORT_FONT_SIZES.metadata}"/><name val="Arial"/></font><font><b/><sz val="${REPORT_FONT_SIZES.header}"/><name val="Arial"/></font><font><sz val="${REPORT_FONT_SIZES.body}"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="6"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border><border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top/><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border><border><left style="thin"><color rgb="FF000000"/></left><right/><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border><border><left/><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="13"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="4" fillId="0" borderId="1" xfId="0" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="2" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="3" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="4" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="5" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs></styleSheet>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1" autoPageBreaks="0"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="6" topLeftCell="A7" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}${timbang ? '<col min="10" max="10" width="5" hidden="1" customWidth="1"/>' : ""}</cols><sheetData>${rows}</sheetData>${timbang ? `<mergeCells count="13"><mergeCell ref="A1:I1"/><mergeCell ref="A2:G2"/><mergeCell ref="A3:G3"/><mergeCell ref="A4:G4"/>${TIMBANG_HEADERS.map((_, index) => `<mergeCell ref="${col(index)}5:${col(index)}6"/>`).join("")}</mergeCells>` : '<mergeCells count="12"><mergeCell ref="A1:K1"/><mergeCell ref="A2:I2"/><mergeCell ref="A3:I3"/><mergeCell ref="A4:I4"/><mergeCell ref="A5:A6"/><mergeCell ref="B5:B6"/><mergeCell ref="C5:C6"/><mergeCell ref="D5:D6"/><mergeCell ref="E5:E6"/><mergeCell ref="G5:H5"/><mergeCell ref="I5:J5"/><mergeCell ref="K5:K6"/></mergeCells>'}<printOptions horizontalCentered="1" gridLines="0" headings="0"/><pageMargins left="${REPORT_PAGE_MARGINS.horizontal}" right="${REPORT_PAGE_MARGINS.horizontal}" top="${REPORT_PAGE_MARGINS.vertical}" bottom="${REPORT_PAGE_MARGINS.vertical}" header="0.15" footer="0.15"/><pageSetup paperSize="14" orientation="landscape" fitToWidth="1" fitToHeight="0" usePrinterDefaults="0"/></worksheet>`,
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, body]) => [name, new TextEncoder().encode(body)])), { level: 6 });
}
