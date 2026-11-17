export type Sex = "F" | "M";

export function todayInManila(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isValidBirthday(value: string, today = todayInManila()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day && value <= today;
}

export function ageInMonths(birthday: string, today = todayInManila()): number {
  if (!isValidBirthday(birthday, today)) throw new Error("Invalid birthday");
  const [birthYear, birthMonth, birthDay] = birthday.split("-").map(Number);
  const [year, month, day] = today.split("-").map(Number);
  return (year - birthYear) * 12 + month - birthMonth - (day < birthDay ? 1 : 0);
}

function safeCell(value: string | number): string {
  let text = String(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function makeCsv(rows: Array<Array<string | number>>): string {
  return "\uFEFF" + rows.map((row) => row.map(safeCell).join(",")).join("\r\n") + "\r\n";
}
