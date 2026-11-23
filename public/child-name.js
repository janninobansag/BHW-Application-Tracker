/** Normalize spacing without changing the spelling of a child's name. */
const clean = (value) => String(value || "").trim().replace(/\s+/gu, " ");
const initialPattern = /^\p{L}\.?$/u;

/** Split a stored name for editing. Older records need their parts checked. */
export function splitChildName(name, recordedSurname = "", recordedMiddleInitial = "", recordedFirstName = "") {
  const full = clean(name);
  let surname = clean(recordedSurname);
  let given = full;
  if (surname) {
    if (full.toLocaleLowerCase().endsWith(` ${surname.toLocaleLowerCase()}`)) given = full.slice(0, -(surname.length + 1)).trim();
  } else if (full.includes(",")) {
    const comma = full.indexOf(",");
    surname = full.slice(0, comma).trim();
    given = full.slice(comma + 1).trim();
  } else {
    const parts = full.split(" ");
    if (parts.length > 1) {
      const suffix = parts.length > 2 && /^(?:Jr\.?|Sr\.?|II|III|IV)$/iu.test(parts.at(-1) ?? "") ? parts.pop() : "";
      surname = parts.pop() ?? "";
      while (parts.length > 1 && /^(?:de|del|dela|la|las|los|san|santa)$/iu.test(parts.at(-1) ?? "")) surname = `${parts.pop()} ${surname}`;
      if (suffix) surname = `${surname} ${suffix}`;
      given = parts.join(" ");
    }
  }
  if (recordedFirstName) {
    const initial = clean(recordedMiddleInitial);
    return { surname, middleInitial: initial ? `${[...initial][0].toLocaleUpperCase("en-PH")}.` : "", firstName: clean(recordedFirstName) };
  }
  let middleInitial = clean(recordedMiddleInitial);
  if (middleInitial && given.toLocaleLowerCase().endsWith(` ${middleInitial.toLocaleLowerCase()}`)) given = given.slice(0, -(middleInitial.length + 1)).trim();
  if (!middleInitial) {
    const parts = given.split(" ");
    if (parts.length > 1 && initialPattern.test(parts.at(-1) ?? "")) {
      middleInitial = parts.pop() ?? "";
      given = parts.join(" ");
    }
  }
  if (middleInitial && !middleInitial.endsWith(".")) middleInitial += ".";
  return { surname, middleInitial, firstName: given };
}

/** Display as Surname, First name, M.I.; omit the middle initial when absent. */
export function displayChildName(name, recordedSurname = "", recordedMiddleInitial = "", recordedFirstName = "") {
  const { surname, middleInitial, firstName } = splitChildName(name, recordedSurname, recordedMiddleInitial, recordedFirstName);
  if (!surname) return clean(name);
  return `${surname}, ${firstName}${middleInitial ? ` ${middleInitial}` : ""}`.trim();
}

const collator = new Intl.Collator("en-PH", { sensitivity: "base", numeric: true });

export function compareChildNames(first, second, firstSurname = "", secondSurname = "") {
  return collator.compare(displayChildName(first, firstSurname), displayChildName(second, secondSurname));
}
