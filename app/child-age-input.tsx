"use client";

import { useState } from "react";
import { ageInMonths, isValidBirthday } from "../lib/bhw";

export function ChildAgeInput({ initial = "", today, inputId = "birthday-new" }: { initial?: string; today: string; inputId?: string }) {
  const [birthday, setBirthday] = useState(initial);
  const months = isValidBirthday(birthday, today) ? ageInMonths(birthday, today) : null;
  return <div className="field"><label htmlFor={inputId}>Birthday</label>
    <input id={inputId} name="birthday" type="date" required max={today}
      value={birthday} onChange={(event) => setBirthday(event.target.value)} />
    <small className="field-hint">{months === null ? "Age appears after you choose a birthday." : `Age: ${months} full months`}</small>
  </div>;
}
