export type HouseholdMember = {
  id: string;
  surname: string; firstName: string; middleName: string;
  relationship: string; sex: "F" | "M"; birthday: string;
  heightCm: string; weightKg: string; birthPlace: string;
  classifications: [string, string, string, string];
  religion: string; civilStatus: string; education: string;
  nipStatus: string; covidStatus: string; profileRemarks: string;
  philhealthId: string; membershipType: string; nutritionStatus: string;
  sexuallyActive: string; lastMenstrualPeriod: string; familyPlanningMethod: string;
  cancer: string; mentalHealth: string; hypertension: string; diabetes: string; tbDots: string;
  healthRemarks: string;
};

export type HouseholdInput = {
  barangayId: string; purokId: string; sitioId: string;
  householdNumber: string;
  respondent: { surname: string; firstName: string; middleName: string };
  respondentRelationship: string;
  visits: [string, string, string, string];
  nhts: string; indigenous: string; tribe: string;
  headPhilhealth: string; headPhilhealthId: string; headPhilhealthCategory: string;
  income: string; renter: string; renterMonths: string;
  waterSource: string; waterSourceOther: string; toiletType: string; wasteMethod: string;
  blindDrainage: string; hazards: string[]; hazardOther: string;
  interviewedBy: string; reviewedBy: string; encodedBy: string; dateEncoded: string;
  members: HouseholdMember[];
};

export type HouseholdProfile = HouseholdInput & {
  id: string; created_by: string; created_at: string; updated_at: string;
  barangay_name?: string; purok_name?: string; sitio_name?: string; worker_name?: string;
};

const text = (value: unknown, max: number): string | null => typeof value === "string" && value.trim().length <= max ? value.trim().replace(/\s+/gu, " ") : null;
const choice = (value: unknown, choices: readonly string[]): string | null => typeof value === "string" && choices.includes(value) ? value : null;
const object = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

function date(value: unknown): string | null {
  if (value === "") return "";
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const today = (part: string) => parts.find((item) => item.type === part)?.value ?? "";
  return value <= `${today("year")}-${today("month")}-${today("day")}` ? value : null;
}

const memberFields = {
  id: 160, surname: 100, firstName: 100, middleName: 100, relationship: 60,
  heightCm: 8, weightKg: 8, birthPlace: 120, religion: 80,
  civilStatus: 40, education: 60, nipStatus: 60, covidStatus: 40,
  profileRemarks: 240, philhealthId: 60, membershipType: 60,
  nutritionStatus: 60, familyPlanningMethod: 100, healthRemarks: 240,
} as const;
const yesNo = ["", "yes", "no"] as const;
const yesNoNa = ["", "yes", "no", "na"] as const;

function parseMember(value: unknown): HouseholdMember | null {
  const source = object(value);
  if (!source) return null;
  const fields = Object.fromEntries(Object.entries(memberFields).map(([key, max]) => [key, text(source[key] ?? "", max)])) as Record<keyof typeof memberFields, string | null>;
  if (Object.values(fields).some((entry) => entry === null) || !fields.id || !fields.surname || !fields.firstName) return null;
  const birthday = date(source.birthday);
  const sex = choice(source.sex, ["F", "M"]);
  if (!birthday || !sex || !fields.relationship) return null;
  for (const key of ["heightCm", "weightKg"] as const) {
    if (fields[key] && (!/^\d{1,3}(?:\.\d{1,2})?$/.test(fields[key]) || Number(fields[key]) <= 0 || Number(fields[key]) > 300)) return null;
  }
  if (!Array.isArray(source.classifications) || source.classifications.length !== 4) return null;
  const classifications = source.classifications.map((entry) => text(entry ?? "", 40));
  if (classifications.some((entry) => entry === null)) return null;
  const lastMenstrualPeriod = date(source.lastMenstrualPeriod ?? "");
  const sexuallyActive = choice(source.sexuallyActive ?? "", yesNoNa);
  const flags = ["cancer", "mentalHealth", "hypertension", "diabetes", "tbDots"] as const;
  const values = Object.fromEntries(flags.map((key) => [key, choice(source[key] ?? "", yesNoNa)])) as Record<typeof flags[number], string | null>;
  if (lastMenstrualPeriod === null || sexuallyActive === null || Object.values(values).some((entry) => entry === null)) return null;
  return { ...fields, birthday, sex, classifications: classifications as HouseholdMember["classifications"], lastMenstrualPeriod, sexuallyActive, ...values } as HouseholdMember;
}

export function parseHouseholdProfile(value: unknown): HouseholdInput | null {
  const source = object(value);
  const respondent = object(source?.respondent);
  if (!source || !respondent) return null;
  const barangayId = text(source.barangayId, 160);
  const purokId = text(source.purokId, 160);
  const sitioId = text(source.sitioId ?? "", 160);
  const householdNumber = text(source.householdNumber, 80);
  const firstName = text(respondent.firstName, 100);
  const middleName = text(respondent.middleName ?? "", 100);
  const surname = text(respondent.surname, 100);
  if (!barangayId || !purokId || sitioId === null || !householdNumber || !firstName || middleName === null || !surname) return null;
  if (!Array.isArray(source.visits) || source.visits.length !== 4) return null;
  const visits = source.visits.map((entry) => date(entry ?? ""));
  if (visits.some((entry) => entry === null)) return null;
  const names = ["respondentRelationship", "tribe", "headPhilhealthId", "headPhilhealthCategory", "renterMonths", "waterSourceOther", "hazardOther", "interviewedBy", "reviewedBy", "encodedBy"] as const;
  const lengths = [60, 100, 60, 60, 20, 100, 100, 120, 120, 120];
  const strings = Object.fromEntries(names.map((key, index) => [key, text(source[key] ?? "", lengths[index])])) as Record<typeof names[number], string | null>;
  if (Object.values(strings).some((entry) => entry === null)) return null;
  const nhts = choice(source.nhts ?? "", ["", "nhts-4ps", "nhts-non4ps", "non-nhts"]);
  const indigenous = choice(source.indigenous ?? "", ["", "ip", "non-ip"]);
  const headPhilhealth = choice(source.headPhilhealth ?? "", yesNo);
  const income = choice(source.income ?? "", ["", "A", "B", "C", "D", "E", "F", "G", "refused"]);
  const renter = choice(source.renter ?? "", yesNo);
  const waterSource = choice(source.waterSource ?? "", ["", "level-1", "level-2", "level-3", "other"]);
  const toiletType = choice(source.toiletType ?? "", ["", "A", "B", "C", "D", "E", "F", "G"]);
  const wasteMethod = choice(source.wasteMethod ?? "", ["", "A", "B", "C", "D", "E"]);
  const blindDrainage = choice(source.blindDrainage ?? "", yesNo);
  const dateEncoded = date(source.dateEncoded ?? "");
  if ([nhts, indigenous, headPhilhealth, income, renter, waterSource, toiletType, wasteMethod, blindDrainage, dateEncoded].some((entry) => entry === null)) return null;
  if (strings.renterMonths && (!/^\d{1,3}$/.test(strings.renterMonths) || Number(strings.renterMonths) > 1200)) return null;
  const allowedHazards = ["storm-surge", "flood", "landslide", "other"];
  if (!Array.isArray(source.hazards ?? []) || (source.hazards as unknown[] | undefined ?? []).length > allowedHazards.length || (source.hazards as unknown[] | undefined ?? []).some((entry) => !allowedHazards.includes(String(entry)))) return null;
  if (!Array.isArray(source.members) || source.members.length < 1 || source.members.length > 10) return null;
  const members = source.members.map(parseMember);
  if (members.some((entry) => entry === null) || new Set(members.map((entry) => entry?.id)).size !== members.length) return null;
  return {
    barangayId, purokId, sitioId, householdNumber,
    respondent: { firstName, middleName, surname }, respondentRelationship: strings.respondentRelationship!, visits: visits as HouseholdInput["visits"],
    nhts: nhts!, indigenous: indigenous!, tribe: strings.tribe!, headPhilhealth: headPhilhealth!,
    headPhilhealthId: strings.headPhilhealthId!, headPhilhealthCategory: strings.headPhilhealthCategory!,
    income: income!, renter: renter!, renterMonths: strings.renterMonths!, waterSource: waterSource!,
    waterSourceOther: strings.waterSourceOther!, toiletType: toiletType!, wasteMethod: wasteMethod!,
    blindDrainage: blindDrainage!, hazards: [...new Set(source.hazards as string[] | undefined ?? [])], hazardOther: strings.hazardOther!,
    interviewedBy: strings.interviewedBy!, reviewedBy: strings.reviewedBy!, encodedBy: strings.encodedBy!,
    dateEncoded: dateEncoded!, members: members as HouseholdMember[],
  };
}
