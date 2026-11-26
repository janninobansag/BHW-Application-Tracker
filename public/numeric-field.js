export function isAllowedNumericInput(value, mode) {
  if (mode === "numeric") return /^\d{0,4}$/.test(value);
  if (mode === "decimal") return /^\d{0,3}(?:\.\d{0,2})?$/.test(value);
  return true;
}
