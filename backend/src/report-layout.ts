export type ReportProgram = "deworming" | "timbang";
export type ReportHeading = { barangay: string; sitio: string; purok: string; bhw: string; year?: string };
export const TIMBANG_COLUMN_WIDTHS = [7, 38, 17, 22, 12, 14, 14, 12, 36];
export const TIMBANG_HEADERS = ["NO.", "NAME", "DATE OF BIRTH", "PUROK", "MONTHS", "WEIGHT (kg)", "HEIGHT (cm)", "MUAC (cm)", "GUARDIAN"];
