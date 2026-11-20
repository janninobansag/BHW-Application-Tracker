export type ReportProgram = "deworming" | "timbang";
export type ReportHeading = { barangay: string; sitio: string; purok: string; bhw: string; year?: string };
export const REPORT_FONT_SIZES = { widthCalibration: 11, title: 13, metadata: 13, header: 13, body: 13 } as const;
export const REPORT_ROW_HEIGHTS = { title: 38, metadata: 28, headerTop: 23, headerBottom: 24, dataMinimum: 30, dataLine: 18, dataPadding: 10 } as const;
export const REPORT_PAGE_MARGINS = { horizontal: 0.25, vertical: 0.35 } as const;
export const TIMBANG_COLUMN_WIDTHS = [7, 38, 17, 22, 12, 14, 14, 12, 36];
export const TIMBANG_HEADERS = ["NO.", "NAME", "DATE OF BIRTH", "PUROK", "MONTHS", "WEIGHT (kg)", "HEIGHT (cm)", "MUAC (cm)", "GUARDIAN"];
