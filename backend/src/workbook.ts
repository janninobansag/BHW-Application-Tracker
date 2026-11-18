import { zipSync } from "fflate";

type WorkbookHeading = { barangay: string; sitio: string; purok: string; bhw: string };

const xml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char]!));
const col = (index: number) => String.fromCharCode(65 + index);
const textCell = (ref: string, value: string, style: number) => `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
const numberCell = (ref: string, value: number, style: number) => `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
const formulaCell = (ref: string, formula: string, style: number, cachedValue: number) => `<c r="${ref}" s="${style}"><f>${xml(formula)}</f><v>${cachedValue}</v></c>`;

export function makeWorkbook(heading: WorkbookHeading, records: Array<Array<string | number>>): Uint8Array {
  const widths = [7, 30, 17, 24, 12, 14, 18, 18, 20, 20, 32];
  const lastRow = Math.max(7, records.length + 6);
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
    `<row r="5" ht="23">${[[0,"NO."],[1,"NAME"],[2,"DATE OF BIRTH"],[3,"PUROK"],[4,"MONTHS"],[5,"Gender"],[6,"Vitamin A"],[8,"Deworming"],[10,"GUARDIAN"]].map(([i,v]) => textCell(`${col(Number(i))}5`, String(v), 3)).join("")}</row>`,
    `<row r="6" ht="24">${[[5,"M/F"],[6,"1ST DOSE"],[7,"2ND DOSE"],[8,"1ST DOSE"],[9,"2ND DOSE"]].map(([i,v]) => textCell(`${col(Number(i))}6`, String(v), 3)).join("")}</row>`,
    dataRows,
  ].join("");

  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Vitamin A and Deworming" sheetId="1" r:id="rId1"/></sheets><calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="mm/dd/yyyy"/></numFmts><fonts count="5"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="20"/><name val="Arial"/></font><font><b/><sz val="12"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font><font><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCEFE6"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="164" fontId="4" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs></styleSheet>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="6" topLeftCell="A7" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols><sheetData>${rows}</sheetData><mergeCells count="12"><mergeCell ref="A1:K1"/><mergeCell ref="A2:I2"/><mergeCell ref="A3:I3"/><mergeCell ref="A4:I4"/><mergeCell ref="A5:A6"/><mergeCell ref="B5:B6"/><mergeCell ref="C5:C6"/><mergeCell ref="D5:D6"/><mergeCell ref="E5:E6"/><mergeCell ref="G5:H5"/><mergeCell ref="I5:J5"/><mergeCell ref="K5:K6"/></mergeCells></worksheet>`,
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, body]) => [name, new TextEncoder().encode(body)])), { level: 6 });
}
