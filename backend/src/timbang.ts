export type Measurements = { weight: number | null; height: number | null; muac: number | null };

// Blank measurements are allowed while a child is awaiting measurement.
export function parseMeasurements(input: Record<string, unknown>): Measurements | null {
  const result: Measurements = { weight: null, height: null, muac: null };
  for (const field of ["weight", "height", "muac"] as const) {
    const raw = input[field];
    if (raw === undefined || raw === null || raw === "") continue;
    if ((typeof raw !== "number" && typeof raw !== "string") || !/^\d+(?:\.\d{1,2})?$/.test(String(raw))) return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0 || value > 1000) return null;
    result[field] = value;
  }
  return result;
}
