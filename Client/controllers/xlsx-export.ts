import { zipSync } from "fflate";
import { NextRequest } from "next/server";
import { getCurrentUser } from "@/Services/auth";
import { ageInMonths, todayInManila } from "@/Services/child-records";
import { listBarangays, listChildren } from "@/Data/repositories";
import { siteCopy } from "@/Resources/copy";

export const dynamic = "force-dynamic";

const escapeXml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
}[char]!));

const columnName = (index: number) => {
  let name = "";
  for (let number = index + 1; number > 0; number = Math.floor((number - 1) / 26)) {
    name = String.fromCharCode(65 + ((number - 1) % 26)) + name;
  }
  return name;
};

function cell(ref: string, value: string | number, style: number) {
  const styleAttr = ` s="${style}"`;
  if (typeof value === "number") return `<c r="${ref}"${styleAttr}><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function makeWorkbook(barangayTitle: string, records: Array<Array<string | number>>) {
  const widths = [7, 30, 17, 24, 12, 14, 18, 18, 20, 20, 32];
  const rows = [
    `<row r="1" ht="32" customHeight="1">${cell("A1", siteCopy.csvTitle, 1)}</row>`,
    `<row r="2" ht="25" customHeight="1">${cell("A2", barangayTitle, 2)}</row>`,
    `<row r="3" ht="8" customHeight="1"></row>`,
    `<row r="4" ht="27" customHeight="1">${[
      [0, "NO."], [1, "NAME"], [2, "DATE OF BIRTH"], [3, "PUROK"], [4, "MONTHS"], [5, "Gender"], [6, "Vitamin A"], [8, "Deworming"], [10, "GUARDIAN"],
    ].map(([index, value]) => cell(`${columnName(Number(index))}4`, String(value), 3)).join("")}</row>`,
    `<row r="5" ht="26" customHeight="1">${[
      "", "", "", "", "", "M/F", "1ST DOSE", "2ND DOSE", "1ST DOSE", "2ND DOSE", "",
    ].map((value, index) => value ? cell(`${columnName(index)}5`, value, 3) : "").join("")}</row>`,
    ...records.map((record, index) => `<row r="${index + 6}" ht="23" customHeight="1">${record.map((value, col) => cell(`${columnName(col)}${index + 6}`, value, 4)).join("")}</row>`),
  ].join("");

  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Vitamin A and Deworming" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="20"/><name val="Arial"/></font><font><b/><sz val="12"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCEFE6"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF78928A"/></left><right style="thin"><color rgb="FF78928A"/></right><top style="thin"><color rgb="FF78928A"/></top><bottom style="thin"><color rgb="FF78928A"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf></cellXfs></styleSheet>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="23"/><cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols><sheetData>${rows}</sheetData><mergeCells count="11"><mergeCell ref="A1:K1"/><mergeCell ref="A2:K2"/><mergeCell ref="A4:A5"/><mergeCell ref="B4:B5"/><mergeCell ref="C4:C5"/><mergeCell ref="D4:D5"/><mergeCell ref="E4:E5"/><mergeCell ref="F4:F5"/><mergeCell ref="G4:H4"/><mergeCell ref="I4:J4"/><mergeCell ref="K4:K5"/></mergeCells></worksheet>`,
  };
  const entries = Object.fromEntries(Object.entries(files).map(([path, body]) => [path, new TextEncoder().encode(body)]));
  return zipSync(entries, { level: 6 });
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.must_change_password) return new Response("Unauthorized", { status: 401 });
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const barangay = request.nextUrl.searchParams.get("barangay") ?? "";
  const today = todayInManila();
  const [children, assignedBarangays] = await Promise.all([
    listChildren(user, q, barangay),
    listBarangays(user),
  ]);
  const selectedBarangays = assignedBarangays.filter((item) => !barangay || item.id === barangay).map((item) => item.name);
  const barangayTitle = selectedBarangays.length === 1
    ? `BARANGAY ${selectedBarangays[0].toUpperCase()}, ${siteCopy.csvLocationSuffix}`
    : `BARANGAYS ${selectedBarangays.map((name) => name.toUpperCase()).join(", ")}, ${siteCopy.csvLocationSuffix}`;
  const records = children.map((child, index) => [
    `${index + 1}.`, child.name, child.birthday, child.barangay_name,
    ageInMonths(child.birthday, today), child.sex, "", "", "", "", child.parents,
  ] as Array<string | number>);
  const workbook = makeWorkbook(barangayTitle, records);
  return new Response(workbook as unknown as BodyInit, { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="vitamin-a-deworming-${today}.xlsx"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
