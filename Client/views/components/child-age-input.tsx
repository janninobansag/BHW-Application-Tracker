"use client";

import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { ageInMonths, isValidBirthday } from "@/Services/child-records";

function dateToText(date: string) {
  const [year, month, day] = date.split("-");
  return year && month && day ? `${month}/${day}/${year}` : "";
}

function formatBirthdayEntry(value: string) {
  if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return dateToText(value);
  const digits = value.replace(/[^0-9]/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("/");
}

function parseBirthday(value: string, today: string): { date: string; error: string } {
  const text = value.trim();
  if (!text) return { date: "", error: "" };

  let year = "";
  let month = "";
  let day = "";
  if (/^[0-9]{8}$/.test(text)) {
    month = text.slice(0, 2);
    day = text.slice(2, 4);
    year = text.slice(4);
  } else if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(text)) {
    [year, month, day] = text.split("-");
  } else {
    const parts = text.match(/^([0-9]{1,2})[/-]([0-9]{1,2})[/-]([0-9]{4})$/);
    if (!parts) return { date: "", error: "Enter a complete birthday in MM/DD/YYYY format." };
    [, month, day, year] = parts;
  }

  const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  if (!isValidBirthday(date, "9999-12-31")) return { date: "", error: "Enter a real calendar date." };
  if (date > today) return { date: "", error: "Birthday cannot be in the future." };
  return { date, error: "" };
}

export function ChildAgeInput({ initial = "", today, inputId = "birthday-new" }: { initial?: string; today: string; inputId?: string }) {
  const [birthdayText, setBirthdayText] = useState(dateToText(initial));
  const [touched, setTouched] = useState(false);
  const textInputRef = useRef<HTMLInputElement>(null);
  const parsed = parseBirthday(birthdayText, today);
  const months = parsed.date ? ageInMonths(parsed.date, today) : null;
  const hintId = `${inputId}-hint`;

  function updateManualEntry(value: string, selectionStart: number | null) {
    const digitsBeforeCursor = value.slice(0, selectionStart ?? value.length).replace(/[^0-9]/g, "").length;
    const formatted = formatBirthdayEntry(value);
    const next = parseBirthday(formatted, today);
    setBirthdayText(formatted);
    textInputRef.current?.setCustomValidity(formatted ? next.error : "");
    let cursor = 0;
    let seen = 0;
    while (cursor < formatted.length && seen < digitsBeforeCursor) {
      if (/[0-9]/.test(formatted[cursor])) seen++;
      cursor++;
    }
    requestAnimationFrame(() => {
      if (document.activeElement === textInputRef.current) textInputRef.current?.setSelectionRange(cursor, cursor);
    });
  }

  function chooseCalendarDate(value: string) {
    const next = parseBirthday(value, today);
    setBirthdayText(next.date ? dateToText(next.date) : "");
    textInputRef.current?.setCustomValidity("");
    setTouched(false);
  }

  return <div className="field">
    <label id={`${inputId}-label`} htmlFor={inputId}>Birthday</label>
    <div className="birthday-input-control">
      <input ref={textInputRef} id={inputId} name={`${inputId}-text`} type="text" inputMode="numeric" autoComplete="bday" autoCapitalize="off" spellCheck={false} placeholder="MM/DD/YYYY" maxLength={10} pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" required aria-describedby={hintId} aria-invalid={touched && Boolean(parsed.error)}
        value={birthdayText} onChange={(event) => updateManualEntry(event.target.value, event.target.selectionStart)} onBlur={() => {
          setTouched(true);
          if (parsed.date) setBirthdayText(dateToText(parsed.date));
        }} />
      <span className="birthday-calendar-control">
        <span className="birthday-calendar-icon" aria-hidden="true"><CalendarDays /></span>
        <span className="sr-only" id={`${inputId}-calendar-label`}>Choose birthday from calendar</span>
        <input className="birthday-calendar-native" type="date" aria-labelledby={`${inputId}-calendar-label`} aria-describedby={hintId} tabIndex={0} max={today} value={parsed.date} onChange={(event) => chooseCalendarDate(event.target.value)} />
      </span>
      <input type="hidden" name="birthday" value={parsed.date} />
    </div>
    <small id={hintId} className="field-hint" aria-live="polite">{touched && parsed.error ? parsed.error : months === null ? "MM/DD/YYYY: 2 digits for month, 2 for day, and 4 for year. Slashes are added automatically." : `Age: ${months} full months`}</small>
  </div>;
}
