export function feetInchesToCm(feet, inches) {
  if (!/^\d$/.test(feet) || (inches !== "" && !/^\d{1,2}(?:\.\d{1,2})?$/.test(inches))) return "";
  const totalInches = Number(feet) * 12 + Number(inches || 0);
  if (Number(inches || 0) >= 12 || totalInches <= 0 || totalInches * 2.54 > 300) return "";
  return (Math.round(totalInches * 2.54 * 100) / 100).toString();
}

export function cmToFeetInches(cm) {
  const value = Number(cm);
  if (!cm || !Number.isFinite(value) || value <= 0) return { feet: "", inches: "" };
  const totalInches = Math.round(value / 2.54 * 100) / 100;
  const feet = Math.floor(totalInches / 12);
  return { feet: String(feet), inches: String(Math.round((totalInches - feet * 12) * 100) / 100) };
}
