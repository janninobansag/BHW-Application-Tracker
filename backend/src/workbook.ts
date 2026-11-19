import { zipSync } from "fflate";

type WorkbookHeading = { barangay: string; sitio: string; purok: string; bhw: string };
export const REPORT_COLUMN_WIDTHS = [7, 30, 17, 24, 12, 14, 18, 18, 20, 20, 32];

const xml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char]!));
const col = (index: number) => String.fromCharCode(65 + index);
const textCell = (ref: string, value: string, style: number) => `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
const numberCell = (ref: string, value: number, style: number) => `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
const formulaCell = (ref: string, formula: string, style: number, cachedValue: number) => `<c r="${ref}" s="${style}"><f>${xml(formula)}</f><v>${cachedValue}</v></c>`;
const blankCell = (ref: string, style: number) => `<c r="${ref}" s="${style}"/>`;

// Include the perimeter cells of merged headings so Excel mobile and desktop
// draw the same continuous borders without adding lines through merged labels.
const verticalHeaderColumns = new Set([0, 1, 2, 3, 4, 10]);
function headerCell(column: number, row: number, value = "") {
  const style = verticalHeaderColumns.has(column) ? (row === 5 ? 9 : 10)
    : row === 5 ? ([6, 8].includes(column) ? 11 : [7, 9].includes(column) ? 12 : 3) : 3;
  return value ? textCell(`${col(column)}${row}`, value, style) : blankCell(`${col(column)}${row}`, style);
}

export function makeWorkbook(heading: WorkbookHeading, records: Array<Array<string | number>>): Uint8Array {
  const widths = REPORT_COLUMN_WIDTHS;
  const lastRow = Math.max(7, records.length + 6);
  const printLastRow = Math.max(6, records.length + 6);
  const maleCount = records.filter((record) => record[5] === "M").length;
  const femaleCount = records.filter((record) => record[5] === "F").length;
  const dataRows = records.map((record, index) => {
    const rowNumber = index + 7;
    const cells = record.map((value, columnIndex) => {
      const reference = `${col(columnIndex)}${rowNumber}`;
      if (columnIndex === 2 && typeof value === "number") return numberCell(reference, value, 5);
      if ([0, 4, 5].includes(columnIndex)) return typeof value === "number"
        ? numberCell(reference, value, 6)
        : textCell(reference, String(value), 6);
      return typeof value === "number" ? numberCell(reference, value, 4) : textCell(reference, String(value), 4);
    }).join("");
    return `<row r="${rowNumber}" ht="23">${cells}</row>`;
  }).join("");

  const rows = [
    `<row r="1" ht="32">${textCell("A1", "VITAMIN A AND DEWORMING", 1)}</row>`,
    `<row r="2" ht="24">${textCell("A2", `Barangay: ${heading.barangay}`, 2)}${textCell("J2", "Male:", 7)}${formulaCell("K2", `COUNTIF(F7:F${lastRow},\"M\")`, 8, maleCount)}</row>`,
    `<row r="3" ht="24">${textCell("A3", `Sitio/Purok: ${heading.sitio} / ${heading.purok}`, 2)}${textCell("J3", "Female:", 7)}${formulaCell("K3", `COUNTIF(F7:F${lastRow},\"F\")`, 8, femaleCount)}</row>`,
    `<row r="4" ht="24">${textCell("A4", `BHW: ${heading.bhw}`, 2)}${textCell("J4", "Total:", 7)}${formulaCell("K4", `COUNTA(B7:B${lastRow})`, 8, records.length)}</row>`,
    `<row r="5" ht="23" customHeight="1">${["NO.","NAME","DATE OF BIRTH","PUROK","MONTHS","Gender","Vitamin A","","Deworming","","GUARDIAN"].map((value, column) => headerCell(column, 5, value)).join("")}</row>`,
    `<row r="6" ht="24" customHeight="1">${["","","","","","M/F","1ST DOSE","2ND DOSE","1ST DOSE","2ND DOSE",""].map((value, column) => headerCell(column, 6, value)).join("")}</row>`,
    dataRows,
  ].join("");

  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Vitamin A and Deworming" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">&apos;Vitamin A and Deworming&apos;!$A$1:$K$${printLastRow}</definedName><definedName name="_xlnm.Print_Titles" localSheetId="0">&apos;Vitamin A and Deworming&apos;!$1:$6</definedName></definedNames><calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="mm&quot;/&quot;dd&quot;/&quot;yyyy"/></numFmts><fonts count="5"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="20"/><name val="Arial"/></font><font><b/><sz val="12"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font><font><sz val="11"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="6"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border><border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top/><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border><border><left style="thin"><color rgb="FF000000"/></left><right/><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border><border><left/><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="13"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="164" fontId="4" fillId="0" borderId="1" xfId="0" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="2" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="3" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="4" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="5" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs></styleSheet>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1" autoPageBreaks="0"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="6" topLeftCell="A7" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols><sheetData>${rows}</sheetData><mergeCells count="12"><mergeCell ref="A1:K1"/><mergeCell ref="A2:I2"/><mergeCell ref="A3:I3"/><mergeCell ref="A4:I4"/><mergeCell ref="A5:A6"/><mergeCell ref="B5:B6"/><mergeCell ref="C5:C6"/><mergeCell ref="D5:D6"/><mergeCell ref="E5:E6"/><mergeCell ref="G5:H5"/><mergeCell ref="I5:J5"/><mergeCell ref="K5:K6"/></mergeCells><printOptions horizontalCentered="1" gridLines="0" headings="0"/><pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.15" footer="0.15"/><pageSetup paperSize="14" orientation="landscape" fitToWidth="1" fitToHeight="0" usePrinterDefaults="0"/></worksheet>`,
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, body]) => [name, new TextEncoder().encode(body)])), { level: 6 });
}
