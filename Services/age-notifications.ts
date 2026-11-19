import type { Child } from "@/Data/entities";
import { ageInMonths, isValidBirthday } from "@/Services/child-records";

export type AgeNotice = { id: string; child: Child; date: string; months: number };

function daysBefore(today: string, days: number) {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function recentAgeChanges(children: Child[], today: string): AgeNotice[] {
  const notices: AgeNotice[] = [];
  for (let day = 0; day < 7; day++) {
    const date = daysBefore(today, day);
    const before = daysBefore(date, 1);
    for (const child of children) {
      if (!isValidBirthday(child.birthday, before)) continue;
      const months = ageInMonths(child.birthday, date);
      if (months > ageInMonths(child.birthday, before)) notices.push({ id: `${child.id}:${date}`, child, date, months });
    }
  }
  return notices;
}
