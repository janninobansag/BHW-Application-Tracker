import { readFile } from "node:fs/promises";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PrintScaling, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { HouseholdProfile } from "./household-profile.js";

const PAGE = { width: 1008, height: 612, margin: 24 };
const black = rgb(0, 0, 0);
const line = (page: PDFPage, x1: number, y1: number, x2: number, y2: number, width = .55) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: width, color: black });
const isoDate = (value: string) => value ? `${value.slice(5, 7)}/${value.slice(8, 10)}/${value.slice(0, 4)}` : "";
const fullName = (member: { surname: string; firstName: string; middleName: string }) => `${member.surname}, ${member.firstName}${member.middleName ? ` ${member.middleName}` : ""}`;

function fit(value: string, font: PDFFont, size: number, width: number, min = 5.4) {
  let result = size;
  while (result > min && font.widthOfTextAtSize(value, result) > width) result -= .2;
  return result;
}

function draw(page: PDFPage, value: string, x: number, y: number, width: number, font: PDFFont, size = 8, align: "left" | "center" = "left") {
  const words = String(value || "").replace(/\s+/gu, " ").trim().split(" ").filter(Boolean);
  const wrap = (textSize: number) => {
    const lines: string[] = [];
    for (const word of words) {
      const previous = lines.length - 1;
      if (previous >= 0 && font.widthOfTextAtSize(`${lines[previous]} ${word}`, textSize) <= width) { lines[previous] += ` ${word}`; continue; }
      let fragment = "";
      for (const character of word) {
        if (fragment && font.widthOfTextAtSize(fragment + character, textSize) > width) { lines.push(fragment); fragment = character; }
        else fragment += character;
      }
      if (fragment) lines.push(fragment);
    }
    return lines;
  };
  let textSize = size;
  let lines = wrap(textSize);
  while (lines.length > 3 && textSize > 4.5) { textSize = Math.max(4.5, textSize - .25); lines = wrap(textSize); }
  if (lines.length > 3) {
    lines = lines.slice(0, 3);
    while (lines[2] && font.widthOfTextAtSize(`${lines[2]}...`, textSize) > width) lines[2] = lines[2].slice(0, -1);
    lines[2] += "...";
  }
  for (const [index, segment] of lines.entries()) {
    const finalSize = fit(segment, font, textSize, width, 4.5);
    const offset = align === "center" ? Math.max(0, (width - font.widthOfTextAtSize(segment, finalSize)) / 2) : 0;
    page.drawText(segment, { x: x + offset, y: y - index * (finalSize + 1), size: finalSize, font, color: black });
  }
}

function box(page: PDFPage, x: number, top: number, width: number, height: number, label: string, value: string, regular: PDFFont, bold: PDFFont) {
  page.drawRectangle({ x, y: top - height, width, height, borderWidth: .55, borderColor: black });
  draw(page, label, x + 5, top - 10, width - 10, bold, 6.4);
  draw(page, value, x + 5, top - 23, width - 10, regular, 8.3);
}

function table(page: PDFPage, top: number, widths: number[], headers: string[], rows: string[][], regular: PDFFont, bold: PDFFont, rowHeight = 29) {
  const x = PAGE.margin;
  const headerHeight = 37;
  const totalWidth = widths.reduce((sum, item) => sum + item, 0);
  const bottom = top - headerHeight - 10 * rowHeight;
  page.drawRectangle({ x, y: bottom, width: totalWidth, height: top - bottom, borderColor: black, borderWidth: .75 });
  line(page, x, top - headerHeight, x + totalWidth, top - headerHeight, .75);
  for (let row = 1; row < 10; row++) line(page, x, top - headerHeight - row * rowHeight, x + totalWidth, top - headerHeight - row * rowHeight);
  let edge = x;
  for (let column = 0; column < widths.length; column++) {
    if (column) line(page, edge, bottom, edge, top);
    draw(page, headers[column], edge + 3, top - 13, widths[column] - 6, bold, 6.6, "center");
    for (let row = 0; row < 10; row++) draw(page, rows[row]?.[column] ?? "", edge + 3, top - headerHeight - row * rowHeight - 11, widths[column] - 6, regular, 7.2);
    edge += widths[column];
  }
  return bottom;
}

function heading(page: PDFPage, label: string, pageNumber: number, bold: PDFFont, regular: PDFFont) {
  draw(page, "REPUBLIC OF THE PHILIPPINES  |  PROVINCE OF CEBU  |  MUNICIPALITY OF MINGLANILLA", PAGE.margin, 588, 960, regular, 8, "center");
  draw(page, label, PAGE.margin, 568, 960, bold, 13, "center");
  draw(page, `${pageNumber} of 2`, 930, 26, 50, regular, 7, "center");
}

function age(birthday: string, reference: string) {
  if (!birthday) return "";
  const [y, m, d] = reference.split("-").map(Number);
  const [by, bm, bd] = birthday.split("-").map(Number);
  return String(y - by - (m < bm || (m === bm && d < bd) ? 1 : 0));
}

export async function makeHouseholdProfilePdf(profile: HouseholdProfile): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle("Household Profile");
  document.registerFontkit(fontkit);
  document.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  const [regularBytes, boldBytes] = await Promise.all(["Regular", "Bold"].map((weight) => readFile(new URL(`../assets/fonts/NotoSans-${weight}.ttf`, import.meta.url))));
  const regular = await document.embedFont(regularBytes, { subset: true });
  const bold = await document.embedFont(boldBytes, { subset: true });
  const first = document.addPage([PAGE.width, PAGE.height]);
  heading(first, "FORM 1. HOUSEHOLD PROFILE VERSION 2", 1, bold, regular);
  const sectionWidth = 960;
  const half = sectionWidth / 2;
  box(first, 24, 548, half / 2, 40, "BARANGAY", profile.barangay_name ?? "", regular, bold);
  box(first, 24 + half / 2, 548, half / 2, 40, "PUROK / SITIO", `${profile.purok_name ?? ""}${profile.sitio_name ? ` / ${profile.sitio_name}` : ""}`, regular, bold);
  box(first, 24 + half, 548, half / 2, 40, "HOUSEHOLD NUMBER", profile.householdNumber, regular, bold);
  box(first, 24 + half * 1.5, 548, half / 2, 40, "FAMILY MONTHLY INCOME", profile.income, regular, bold);
  const visits = ["FIRST", "SECOND", "THIRD", "FOURTH"];
  visits.forEach((label, index) => box(first, 24 + index * 240, 508, 240, 36, `${label} QUARTER - DATE OF VISIT`, isoDate(profile.visits[index]), regular, bold));
  box(first, 24, 472, 384, 39, "NAME OF RESPONDENT", fullName(profile.respondent), regular, bold);
  box(first, 408, 472, 144, 39, "NHTS HOUSEHOLD", profile.nhts, regular, bold);
  box(first, 552, 472, 120, 39, "INDIGENOUS / TRIBE", `${profile.indigenous}${profile.tribe ? ` - ${profile.tribe}` : ""}`, regular, bold);
  box(first, 672, 472, 312, 39, "HH HEAD PHILHEALTH REGISTERED / ID / CATEGORY", `${profile.headPhilhealth}  ${profile.headPhilhealthId}  ${profile.headPhilhealthCategory}`, regular, bold);
  const reference = [...profile.visits].reverse().find(Boolean) || profile.dateEncoded || new Date().toISOString().slice(0, 10);
  const firstWidths = [25, 159, 53, 27, 27, 36, 36, 65, 78, 29, 29, 29, 29, 38, 38, 43, 42, 45, 132];
  const firstRows = profile.members.map((member, index) => [
    `${index + 1}.`, fullName(member), member.relationship, member.sex, age(member.birthday, reference), member.heightCm, member.weightKg,
    isoDate(member.birthday), member.birthPlace, ...member.classifications, member.religion, member.civilStatus,
    member.education, member.nipStatus, member.covidStatus, member.profileRemarks,
  ]);
  table(first, 425, firstWidths, ["NO.", "HOUSEHOLD MEMBER", "RELATION", "SEX", "AGE", "HT cm", "WT kg", "BIRTHDAY", "BIRTH PLACE", "Q1", "Q2", "Q3", "Q4", "RELIGION", "CIVIL", "EDUCATION", "NIP", "COVID", "REMARKS"], firstRows, regular, bold, 28);
  draw(first, "Classification by age / health / risk group: enter the applicable code for each quarter. Relationship: head, spouse, son, daughter, or other.", 26, 91, 940, regular, 7);
  draw(first, "NHTS: 4Ps, non-4Ps, or non-NHTS. Family income categories A-G or refused. Dates use MM/DD/YYYY.", 26, 76, 940, regular, 7);
  draw(first, `Interviewed by: ${profile.interviewedBy}`, 26, 54, 460, regular, 8);

  const second = document.addPage([PAGE.width, PAGE.height]);
  heading(second, "HARMONIZED FAMILY / HOUSEHOLD PROFILE", 2, bold, regular);
  box(second, 24, 548, 240, 40, "BARANGAY / PUROK / SITIO", `${profile.barangay_name ?? ""} / ${profile.purok_name ?? ""} / ${profile.sitio_name ?? ""}`, regular, bold);
  box(second, 264, 548, 190, 40, "HOUSEHOLD NUMBER", profile.householdNumber, regular, bold);
  box(second, 454, 548, 300, 40, "RESPONDENT / RELATION TO HEAD", `${fullName(profile.respondent)}${profile.respondentRelationship ? ` / ${profile.respondentRelationship}` : ""}`, regular, bold);
  box(second, 754, 548, 230, 40, "QUARTERLY VISITS", profile.visits.map(isoDate).filter(Boolean).join(" / "), regular, bold);
  box(second, 24, 508, 160, 36, "RENTER / MONTHS", `${profile.renter} ${profile.renterMonths}`, regular, bold);
  box(second, 184, 508, 160, 36, "WATER SOURCE", `${profile.waterSource} ${profile.waterSourceOther}`, regular, bold);
  box(second, 344, 508, 160, 36, "TOILET TYPE", profile.toiletType, regular, bold);
  box(second, 504, 508, 160, 36, "WASTE METHOD", profile.wasteMethod, regular, bold);
  box(second, 664, 508, 160, 36, "BLIND DRAINAGE", profile.blindDrainage, regular, bold);
  box(second, 824, 508, 160, 36, "HAZARDOUS AREA", `${profile.hazards.join(", ")} ${profile.hazardOther}`, regular, bold);
  const secondWidths = [25, 170, 78, 65, 55, 50, 60, 70, 43, 43, 43, 43, 43, 85, 87];
  const secondRows = profile.members.map((member, index) => [
    `${index + 1}.`, fullName(member), member.philhealthId, member.membershipType, member.nutritionStatus,
    member.sexuallyActive, isoDate(member.lastMenstrualPeriod), member.familyPlanningMethod,
    member.cancer, member.mentalHealth, member.hypertension, member.diabetes, member.tbDots,
    member.healthRemarks, member.profileRemarks,
  ]);
  table(second, 461, secondWidths, ["NO.", "HOUSEHOLD MEMBER", "PHILHEALTH ID", "MEMBERSHIP", "NUTRITION", "SEXUALLY ACTIVE", "LAST MENSES", "FAMILY PLANNING", "CANCER", "MENTAL HEALTH", "HYPERTENSION", "DIABETES", "TB-DOTS", "HEALTH REMARKS", "OTHER REMARKS"], secondRows, regular, bold, 28);
  draw(second, "PhilHealth membership and nutrition status apply to each listed member. Use yes / no / N/A for health conditions where appropriate.", 26, 91, 940, regular, 7);
  draw(second, `Interviewed by: ${profile.interviewedBy}     Reviewed by: ${profile.reviewedBy}`, 26, 66, 940, regular, 8);
  draw(second, `Encoded by: ${profile.encodedBy}     Date encoded: ${isoDate(profile.dateEncoded)}`, 26, 49, 940, regular, 8);
  return document.save();
}
