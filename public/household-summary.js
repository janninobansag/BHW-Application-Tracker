import { classificationOptions, civilStatusOptions, covidOptions, educationOptions, familyPlanningOptions, incomeOptions, membershipOptions, nipOptions, nutritionOptions, religionOptions } from "./household-options.js";

export const summarySectionGroups = [
  { title: "Households and living conditions", indices: [0, 1, 5, 6, 16, 17, 18] },
  { title: "People and demographics", indices: [2, 3, 4, 7, 8, 13] },
  { title: "Health and care", indices: [9, 10, 11, 12, 14, 15] },
];

const choices = (options) => options.filter(([code]) => code);
const section = (title, items, total) => ({ title, items, total });
const tally = (items, getValue, options) => choices(options).map(([code, label]) => ({ label, value: items.filter((item) => getValue(item) === code).length }));
const monthsAt = (birthday, asOf) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday || "")) return -1;
  const [year, month, day] = birthday.split("-").map(Number);
  const [endYear, endMonth, endDay] = asOf.split("-").map(Number);
  return (endYear - year) * 12 + endMonth - month - (endDay < day ? 1 : 0);
};

export function buildHouseholdSummary(profiles, { barangayId = "", purokId = "", sitioId = "", year = "", quarter = "", today = new Date().toISOString().slice(0, 10) } = {}) {
  const selected = profiles.filter((item) => (!barangayId || item.barangayId === barangayId) && (!purokId || item.purokId === purokId) && (!sitioId || item.sitioId === sitioId) && (!year || item.visits.some((date, index) => date?.startsWith(`${year}-`) && (quarter === "" || index === Number(quarter)))));
  const asOf = year ? quarter === "" ? `${year}-12-31` : `${year}-${["03-31", "06-30", "09-30", "12-31"][Number(quarter)]}` : today;
  const members = selected.flatMap((item) => item.members);
  const age = (member) => monthsAt(member.birthday, asOf);
  const currentClassification = (member) => quarter === "" ? member.classifications.slice().reverse().find(Boolean) || "" : member.classifications[Number(quarter)] || "";
  const hasClass = (member, code) => currentClassification(member).split(/\s+/).includes(code);
  const ageGroups = [
    ["0–11 months", (value) => value >= 0 && value < 12],
    ["12 months", (value) => value === 12],
    ["0–59 months", (value) => value >= 0 && value < 60],
    ["5–11 years", (value) => value >= 60 && value < 144],
    ["12–19 years", (value) => value >= 144 && value < 240],
    ["20–59 years", (value) => value >= 240 && value < 720],
    ["60 years and above", (value) => value >= 720],
  ];
  const familyPlanning = choices(familyPlanningOptions).map(([code, label]) => {
    const counts = [[120, 180], [180, 240], [240, 600]].map(([minimum, maximum]) => members.filter((member) => member.sex === "F" && age(member) >= minimum && age(member) < maximum && member.familyPlanningMethod === code).length);
    return { label, groups: counts, value: counts.reduce((sum, count) => sum + count, 0) };
  });
  const summarySections = [
    section("1. Households", [
      { label: "NHTS 4Ps", value: selected.filter((item) => item.nhts === "nhts-4ps").length },
      { label: "NHTS non-4Ps", value: selected.filter((item) => item.nhts === "nhts-non4ps").length },
      { label: "Non-NHTS", value: selected.filter((item) => item.nhts === "non-nhts").length },
    ], selected.length),
    section("2. Indigenous household", tally(selected, (item) => item.indigenous, [["ip", "IP"], ["non-ip", "Non-IP"]]), selected.length),
    section("3. PhilHealth membership", tally(members, (item) => item.membershipType, membershipOptions), members.length),
    section("4. Sex", tally(members, (item) => item.sex, [["M", "Male"], ["F", "Female"]]), members.length),
    section("5. Religion", tally(members, (item) => item.religion?.split(":")[0], religionOptions), members.length),
    section("6. Household ownership", tally(selected, (item) => item.renter, [["yes", "Renter"], ["no", "Not renting"]]), selected.length),
    section("7. Monthly family income", tally(selected, (item) => item.income, incomeOptions), selected.length),
    section("8. Education", tally(members, (item) => item.education, educationOptions), members.length),
    section("9. Civil status", tally(members, (item) => item.civilStatus, civilStatusOptions), members.length),
    section("10. Age and risk classification", choices(classificationOptions).map(([code, label]) => ({ label, value: members.filter((item) => hasClass(item, code)).length })), members.length),
    section("11. Health history", [["cancer", "Cancer"], ["mentalHealth", "Mental health condition"], ["hypertension", "Hypertension"], ["diabetes", "Diabetes"], ["tbDots", "TB-DOTS"]].map(([key, label]) => ({ label, value: members.filter((item) => item[key] === "yes").length })), members.length),
    section("14. COVID-19 vaccination", tally(members, (item) => item.covidStatus, covidOptions), members.length),
    section("14. NIP vaccination (under 1 year)", tally(members.filter((item) => age(item) >= 0 && age(item) < 12), (item) => item.nipStatus, nipOptions), members.filter((item) => age(item) >= 0 && age(item) < 12).length),
    section("15. Age", ageGroups.flatMap(([label, matches]) => [["M", "Male"], ["F", "Female"]].map(([sex, sexLabel]) => ({ label: `${label} · ${sexLabel}`, value: members.filter((item) => item.sex === sex && matches(age(item))).length }))), members.length),
    section("16. Nutrition (0–59 months)", tally(members.filter((item) => age(item) >= 0 && age(item) < 60), (item) => item.nutritionStatus, nutritionOptions), members.filter((item) => age(item) >= 0 && age(item) < 60).length),
    section("17. Pregnant women", [[120, 180, "10–14 years"], [180, 240, "15–19 years"], [240, 600, "20–49 years"]].map(([minimum, maximum, label]) => ({ label, value: members.filter((item) => item.sex === "F" && age(item) >= minimum && age(item) < maximum && (hasClass(item, "P") || hasClass(item, "AP"))).length })), members.filter((item) => item.sex === "F" && (hasClass(item, "P") || hasClass(item, "AP"))).length),
    section("19. Toilet type", tally(selected, (item) => item.toiletType, [["A", "A – Flush to septic tank"], ["B", "B – Flush to sewerage"], ["C", "C – Ventilated pit latrine"], ["D", "D – Water-sealed toilet"], ["E", "E – Overhung latrine"], ["F", "F – Open pit latrine"], ["G", "G – No toilet"]]), selected.length),
    section("20. Water source", tally(selected, (item) => item.waterSource, [["level-1", "Level I – Point source"], ["level-2", "Level II – Communal faucet"], ["level-3", "Level III – Individual connection"], ["other", "Other source"]]), selected.length),
    section("21. Waste segregation / disposal", tally(selected, (item) => item.wasteMethod, [["A", "A – Proper segregation"], ["B", "B – Backyard composting"], ["C", "C – Recycling / reuse"], ["D", "D – Municipal collection"], ["E", "E – Other"]]), selected.length),
  ];
  return { households: selected.length, members: members.length, asOf, sections: summarySections, familyPlanning, familyPlanningTotal: familyPlanning.reduce((sum, row) => sum + row.value, 0) };
}
