"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { AppUser, Barangay, HouseholdInput, HouseholdMember, HouseholdProfile, Purok, Sitio } from "@/Data/entities";
import { prepareWorkerWorkspace, queueWorkerHousehold, readWorkerContents, syncWorkerChanges } from "@/public/worker-offline-store.js";
import { classificationOptions, civilStatusOptions, covidOptions, educationOptions, familyPlanningOptions, incomeOptions, membershipOptions, nipOptions, nutritionOptions, relationshipOptions, religionOptions } from "@/public/household-options.js";

const blankMember = (): HouseholdMember => ({
  id: crypto.randomUUID(), surname: "", firstName: "", middleName: "", relationship: "", sex: "M", birthday: "",
  heightCm: "", weightKg: "", birthPlace: "", classifications: ["", "", "", ""],
  religion: "", civilStatus: "", education: "", nipStatus: "", covidStatus: "", profileRemarks: "",
  philhealthId: "", membershipType: "", nutritionStatus: "", sexuallyActive: "", lastMenstrualPeriod: "",
  familyPlanningMethod: "", cancer: "", mentalHealth: "", hypertension: "", diabetes: "", tbDots: "", healthRemarks: "",
});
const blankProfile = (): HouseholdInput => ({
  barangayId: "", purokId: "", sitioId: "", householdNumber: "", respondent: { surname: "", firstName: "", middleName: "" }, respondentRelationship: "",
  visits: ["", "", "", ""], nhts: "", indigenous: "", tribe: "", headPhilhealth: "", headPhilhealthId: "", headPhilhealthCategory: "",
  income: "", renter: "", renterMonths: "", waterSource: "", waterSourceOther: "", toiletType: "", wasteMethod: "",
  blindDrainage: "", hazards: [], hazardOther: "", interviewedBy: "", reviewedBy: "", encodedBy: "", dateEncoded: "", members: [blankMember()],
});
const yesNo = [["", "Select"], ["yes", "Yes"], ["no", "No"]];
const yesNoNa = [...yesNo, ["na", "N/A"]];
const quarters = ["First quarter", "Second quarter", "Third quarter", "Fourth quarter"];
const todayInManila = () => { const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); const value = (type: string) => parts.find((part) => part.type === type)?.value ?? ""; return `${value("year")}-${value("month")}-${value("day")}`; };

function Field({ label, value, onChange, required, attempted = false, hint, type = "text", inputMode, maxLength }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; attempted?: boolean; hint?: string; type?: string; inputMode?: "numeric" | "decimal"; maxLength?: number }) {
  const id = useId();
  const missing = Boolean(required && attempted && !value.trim());
  return <div className="household-field"><label htmlFor={id}>{label}{required && <span className={`household-required-mark${missing ? " is-missing" : ""}`} aria-hidden="true"> *</span>}</label><input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} inputMode={inputMode} maxLength={maxLength} aria-invalid={missing} data-required-missing={missing || undefined} aria-describedby={[hint && `${id}-hint`, missing && `${id}-error`].filter(Boolean).join(" ") || undefined} />{hint && <small id={`${id}-hint`}>{hint}</small>}{missing && <small id={`${id}-error`} className="household-field-error">{label} is required.</small>}</div>;
}

function SelectField({ label, value, onChange, options, required, attempted = false, disabled }: { label: string; value: string; onChange: (value: string) => void; options: string[][]; required?: boolean; attempted?: boolean; disabled?: boolean }) {
  const id = useId();
  const missing = Boolean(required && attempted && !value);
  const choices = value && !options.some(([key]) => key === value) ? [...options, [value, `Previously entered: ${value}`]] : options;
  return <div className="household-field"><label htmlFor={id}>{label}{required && <span className={`household-required-mark${missing ? " is-missing" : ""}`} aria-hidden="true"> *</span>}</label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} required={required} disabled={disabled} aria-invalid={missing} data-required-missing={missing || undefined} aria-describedby={missing ? `${id}-error` : undefined}>{choices.map(([key, caption]) => <option key={key} value={key}>{caption}</option>)}</select>{missing && <small id={`${id}-error`} className="household-field-error">Select a {label.toLowerCase()}.</small>}</div>;
}

function RelationshipField({ label, value, onChange, required, attempted }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; attempted?: boolean }) {
  const known = relationshipOptions.slice(1, -1).some(([key]) => key === value);
  const other = value.startsWith("Other:") || Boolean(value && !known);
  const specified = value.startsWith("Other:") ? value.slice(6).trimStart() : other ? value : "";
  return <><SelectField label={label} value={other ? "other" : value} onChange={(next) => onChange(next === "other" ? "Other: " : next)} options={relationshipOptions} required={required} attempted={attempted} />{other && <Field label="Specify relationship" value={specified} onChange={(next) => onChange(`Other: ${next}`)} required attempted={attempted} maxLength={53} />}</>;
}

function ReligionField({ value, onChange, attempted }: { value: string; onChange: (value: string) => void; attempted: boolean }) {
  const other = value === "6" || value.startsWith("6:");
  return <><SelectField label="Religion" value={other ? "6" : value} onChange={(next) => onChange(next === "6" ? "6: " : next)} options={religionOptions} /><>{other && <Field label="Specify religion" value={value.startsWith("6:") ? value.slice(2).trimStart() : ""} onChange={(next) => onChange(`6: ${next}`)} required attempted={attempted} maxLength={77} />}</></>;
}

function ClassificationField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const selected = value.split(/\s+/).filter(Boolean);
  const choices = [...classificationOptions, ...selected.filter((code) => !classificationOptions.some(([key]) => key === code)).map((code) => [code, `Previously entered: ${code}`])];
  return <div className="household-field household-classification"><span className="household-code-label">{label}</span><details className="household-code-picker"><summary>{selected.length ? selected.join(" · ") : "Choose classifications"}</summary><div className="household-code-options">{choices.map(([code, caption]) => <label key={code}><input type="checkbox" checked={selected.includes(code)} onChange={(event) => onChange(event.target.checked ? [...selected, code].join(" ") : selected.filter((item) => item !== code).join(" "))} />{caption}</label>)}</div></details><small>Choose all that apply for this visit.</small></div>;
}

function DateField({ label, value, onChange, required, attempted = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; attempted?: boolean }) {
  const id = useId();
  const calendarId = `${id}-calendar`;
  const isoToDisplay = (date: string) => date ? `${date.slice(5, 7)}/${date.slice(8, 10)}/${date.slice(0, 4)}` : "";
  const [draft, setDraft] = useState(isoToDisplay(value));
  const [blurred, setBlurred] = useState(false);
  const emitted = useRef(value);
  useEffect(() => { if (value !== emitted.current) { setDraft(isoToDisplay(value)); emitted.current = value; } }, [value]);
  function change(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    const display = digits.length > 4 ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}` : digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    setDraft(display);
    const iso = digits.length === 8 ? `${digits.slice(4)}-${digits.slice(0, 2)}-${digits.slice(2, 4)}` : "";
    const test = iso ? new Date(`${iso}T00:00:00Z`) : null;
    const next = test && !Number.isNaN(test.getTime()) && test.toISOString().slice(0, 10) === iso && iso <= todayInManila() ? iso : "";
    emitted.current = next;
    onChange(next);
  }
  const missing = Boolean(required && attempted && !value);
  const invalid = draft.length > 0 && !value;
  const showInvalid = invalid && (attempted || blurred);
  return <div className="household-field"><label htmlFor={id}>{label}{required && <span className={`household-required-mark${missing ? " is-missing" : ""}`} aria-hidden="true"> *</span>}</label><div className="household-date"><input id={id} type="text" inputMode="numeric" autoComplete="off" placeholder="MM/DD/YYYY" value={draft} onChange={(event) => change(event.target.value)} onBlur={() => setBlurred(true)} aria-invalid={missing || showInvalid} data-date-invalid={invalid || undefined} data-required-missing={missing || undefined} aria-describedby={`${id}-hint${missing || showInvalid ? ` ${id}-error` : ""}`} required={required} /><input id={calendarId} type="date" value={value} max={todayInManila()} onChange={(event) => { emitted.current = event.target.value; setDraft(isoToDisplay(event.target.value)); onChange(event.target.value); }} aria-label={`Choose ${label.toLowerCase()} from calendar`} /></div><small id={`${id}-hint`}>Type MM/DD/YYYY or use the calendar.</small>{(missing || showInvalid) && <small id={`${id}-error`} className="household-field-error">{invalid ? "Enter a valid date as MM/DD/YYYY." : `${label} is required.`}</small>}</div>;
}

export function HouseholdEditor({ user, barangays, puroks, sitios, existing }: { user: AppUser; barangays: Barangay[]; puroks: Purok[]; sitios: Sitio[]; existing?: HouseholdProfile }) {
  const router = useRouter();
  const [profile, setProfile] = useState<HouseholdInput>(() => existing ? { ...existing, members: existing.members.map((member) => ({ ...member })) } : blankProfile());
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const update = <K extends keyof HouseholdInput>(key: K, value: HouseholdInput[K]) => setProfile((current) => ({ ...current, [key]: value }));
  const updateMember = <K extends keyof HouseholdMember>(id: string, key: K, value: HouseholdMember[K]) => setProfile((current) => ({ ...current, members: current.members.map((member) => member.id === id ? { ...member, [key]: value } : member) }));
  const updateRespondent = (key: keyof HouseholdInput["respondent"], value: string) => update("respondent", { ...profile.respondent, [key]: value });
  const locationPuroks = puroks.filter((item) => item.barangay_id === profile.barangayId);
  const locationSitios = sitios.filter((item) => item.barangay_id === profile.barangayId);
  const memberValid = (member: HouseholdMember) => member.surname.trim() && member.firstName.trim() && member.relationship.trim() && member.relationship.trim() !== "Other:" && member.birthday;

  function focusFirstIssue() {
    requestAnimationFrame(() => {
      const first = document.querySelector<HTMLElement>('.household-editor [data-required-missing="true"], .household-editor [data-date-invalid="true"]');
      if (!first) return;
      const section = first.closest("details");
      if (section) section.open = true;
      first.focus();
    });
  }

  function goToStep(next: 1 | 2) {
    if (next === 2 && (document.querySelector('.household-editor [data-date-invalid="true"]') || !profile.barangayId || !profile.purokId || !profile.householdNumber.trim() || !profile.respondent.surname.trim() || !profile.respondent.firstName.trim() || profile.respondentRelationship.trim() === "Other:" || profile.members.some((member) => !memberValid(member) || member.religion.trim() === "6" || member.religion.trim() === "6:"))) {
      setAttempted(true);
      setError("");
      focusFirstIssue();
      return;
    }
    setError(""); setAttempted(false); setStep(next);
    requestAnimationFrame(() => { headingRef.current?.focus(); headingRef.current?.scrollIntoView({ block: "start" }); });
  }

  async function save() {
    if (saving) return;
    if (document.querySelector('.household-editor [data-date-invalid="true"]')) { setAttempted(true); setError(""); focusFirstIssue(); return; }
    setSaving(true); setError("");
    try {
      const householdId = existing?.id || crypto.randomUUID();
      const saveDirect = async () => {
        const response = await fetch("/api/backend/households", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...profile, id: householdId, expectedUpdatedAt: existing?.updated_at ?? null }) });
        const result = await response.json() as { message?: string; household?: HouseholdProfile };
        if (!response.ok) throw new Error(result.message || "Could not save the household.");
        router.push("/worker-portfolio"); router.refresh();
      };
      if (user.role === "bhw") {
        try {
          if (navigator.onLine && !(await readWorkerContents("households"))) await prepareWorkerWorkspace(user.id);
          await queueWorkerHousehold(profile, householdId, existing?.updated_at);
        } catch (storageError) {
          if (!navigator.onLine) throw storageError;
          await saveDirect();
          return;
        }
        if (!navigator.onLine) { location.assign("/offline.html?view=portfolio"); return; }
        try {
          const copy = await syncWorkerChanges("households");
          if (copy?.pending.length) { location.assign("/offline.html?view=portfolio"); return; }
          router.push("/worker-portfolio"); router.refresh(); return;
        } catch { location.assign("/offline.html?view=portfolio"); return; }
      }
      await saveDirect();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save the household."); }
    finally { setSaving(false); }
  }

  return <section className="panel household-editor" aria-labelledby="household-editor-heading">
    <nav className="household-steps" aria-label="Profile pages"><button type="button" onClick={() => goToStep(1)} aria-current={step === 1 ? "step" : undefined}><span>1</span> Household and members</button><button type="button" onClick={() => goToStep(2)} aria-current={step === 2 ? "step" : undefined}><span>2</span> Health and environment</button></nav>
    <h2 id="household-editor-heading" ref={headingRef} tabIndex={-1}>{step === 1 ? "Household details" : "Health and environment"}</h2>
    <p className="household-intro">{step === 1 ? "Record the visit dates, respondent, and up to ten household members." : "Complete the home conditions and health information for the same members."} <span className="household-required-note">Fields marked * are required.</span></p>
    {error && <p role="alert" className="household-error">{error}</p>}
    {step === 1 ? <div className="household-step-body">
      <fieldset className="household-section"><legend>Location and household</legend><div className="household-grid three">
        <SelectField label="Barangay" value={profile.barangayId} required attempted={attempted} onChange={(value) => setProfile((current) => ({ ...current, barangayId: value, purokId: "", sitioId: "" }))} options={[["", "Select a Barangay"], ...barangays.map((item) => [item.id, item.name])]} />
        <SelectField label="Purok" value={profile.purokId} required attempted={attempted} disabled={!profile.barangayId} onChange={(value) => update("purokId", value)} options={[["", "Select a Purok"], ...locationPuroks.map((item) => [item.id, item.name])]} />
        <SelectField label="Sitio" value={profile.sitioId} onChange={(value) => update("sitioId", value)} options={[["", "Not specified"], ...locationSitios.map((item) => [item.id, item.name])]} />
        <Field label="Household number / address" value={profile.householdNumber} onChange={(value) => update("householdNumber", value)} required attempted={attempted} maxLength={80} />
        <SelectField label="Monthly income group" value={profile.income} onChange={(value) => update("income", value)} options={incomeOptions} />
      </div></fieldset>
      <fieldset className="household-section"><legend>Quarterly visits</legend><div className="household-grid four">{quarters.map((label, index) => <DateField key={label} label={label} value={profile.visits[index]} onChange={(value) => update("visits", profile.visits.map((date, position) => position === index ? value : date) as HouseholdInput["visits"])} attempted={attempted} />)}</div></fieldset>
      <fieldset className="household-section"><legend>Respondent and household status</legend><div className="household-grid three">
        <Field label="Respondent surname" value={profile.respondent.surname} onChange={(value) => updateRespondent("surname", value)} required attempted={attempted} maxLength={100} />
        <Field label="First name" value={profile.respondent.firstName} onChange={(value) => updateRespondent("firstName", value)} required attempted={attempted} maxLength={100} />
        <Field label="Middle name" value={profile.respondent.middleName} onChange={(value) => updateRespondent("middleName", value)} maxLength={100} />
        <RelationshipField label="Relationship to household head" value={profile.respondentRelationship} onChange={(value) => update("respondentRelationship", value)} attempted={attempted} />
        <SelectField label="NHTS household" value={profile.nhts} onChange={(value) => update("nhts", value)} options={[["", "Select"], ["nhts-4ps", "NHTS 4Ps"], ["nhts-non4ps", "NHTS non-4Ps"], ["non-nhts", "Non-NHTS"]]} />
        <SelectField label="Indigenous household" value={profile.indigenous} onChange={(value) => update("indigenous", value)} options={[["", "Select"], ["ip", "IP"], ["non-ip", "Non-IP"]]} />
        {profile.indigenous === "ip" && <Field label="Tribe" value={profile.tribe} onChange={(value) => update("tribe", value)} maxLength={100} />}
        <SelectField label="HH head PhilHealth registered" value={profile.headPhilhealth} onChange={(value) => update("headPhilhealth", value)} options={yesNo} />
        {profile.headPhilhealth === "yes" && <><Field label="PhilHealth ID" value={profile.headPhilhealthId} onChange={(value) => update("headPhilhealthId", value)} maxLength={60} /><SelectField label="PhilHealth category" value={profile.headPhilhealthCategory} onChange={(value) => update("headPhilhealthCategory", value)} options={membershipOptions} /></>}
      </div></fieldset>
      <fieldset className="household-section"><legend>Household members</legend><p className="household-fieldset-note">Start with the household head. Add members in the order shown on the paper form.</p>
        {profile.members.map((member, index) => <details className="household-member" key={member.id} open={index === 0}><summary><strong>{index + 1}. {member.surname || member.firstName ? `${member.surname}, ${member.firstName}` : "New member"}</strong><span>{member.relationship || "Member details"}</span></summary><div className="household-member-body"><div className="household-grid three">
          <Field label="Surname" value={member.surname} onChange={(value) => updateMember(member.id, "surname", value)} required attempted={attempted} maxLength={100} /><Field label="First name" value={member.firstName} onChange={(value) => updateMember(member.id, "firstName", value)} required attempted={attempted} maxLength={100} /><Field label="Middle name" value={member.middleName} onChange={(value) => updateMember(member.id, "middleName", value)} maxLength={100} />
          <RelationshipField label="Relationship to head" value={member.relationship} onChange={(value) => updateMember(member.id, "relationship", value)} required attempted={attempted} /><SelectField label="Sex" value={member.sex} onChange={(value) => updateMember(member.id, "sex", value as "M" | "F")} options={[["M", "Male"], ["F", "Female"]]} /><DateField label="Birthday" value={member.birthday} onChange={(value) => updateMember(member.id, "birthday", value)} required attempted={attempted} />
          <Field label="Height (cm)" value={member.heightCm} onChange={(value) => updateMember(member.id, "heightCm", value)} inputMode="decimal" /><Field label="Weight (kg)" value={member.weightKg} onChange={(value) => updateMember(member.id, "weightKg", value)} inputMode="decimal" /><Field label="Birth place" value={member.birthPlace} onChange={(value) => updateMember(member.id, "birthPlace", value)} maxLength={120} />
          {quarters.map((quarter, position) => <ClassificationField key={quarter} label={`${quarter} classification`} value={member.classifications[position]} onChange={(value) => updateMember(member.id, "classifications", member.classifications.map((entry, place) => place === position ? value : entry) as HouseholdMember["classifications"])} />)}
          <ReligionField value={member.religion} onChange={(value) => updateMember(member.id, "religion", value)} attempted={attempted} /><SelectField label="Civil status" value={member.civilStatus} onChange={(value) => updateMember(member.id, "civilStatus", value)} options={civilStatusOptions} /><SelectField label="Education" value={member.education} onChange={(value) => updateMember(member.id, "education", value)} options={educationOptions} /><SelectField label="NIP vaccination" value={member.nipStatus} onChange={(value) => updateMember(member.id, "nipStatus", value)} options={nipOptions} /><SelectField label="COVID vaccination" value={member.covidStatus} onChange={(value) => updateMember(member.id, "covidStatus", value)} options={covidOptions} /><Field label="Remarks" value={member.profileRemarks} onChange={(value) => updateMember(member.id, "profileRemarks", value)} maxLength={240} />
        </div>{profile.members.length > 1 && <button type="button" className="household-remove" onClick={() => update("members", profile.members.filter((item) => item.id !== member.id))}><Trash2 aria-hidden="true" />Remove member</button>}</div></details>)}
        {profile.members.length < 10 && <button type="button" className="secondary-button household-add" onClick={() => update("members", [...profile.members, blankMember()])}><Plus aria-hidden="true" />Add member</button>}
      </fieldset>
    </div> : <div className="household-step-body">
      <fieldset className="household-section"><legend>Home and surroundings</legend><div className="household-grid three">
        <SelectField label="Renter" value={profile.renter} onChange={(value) => update("renter", value)} options={yesNo} />{profile.renter === "yes" && <Field label="Months renting" value={profile.renterMonths} onChange={(value) => update("renterMonths", value)} inputMode="numeric" />}
        <SelectField label="Water source" value={profile.waterSource} onChange={(value) => update("waterSource", value)} options={[["", "Select"], ["level-1", "Level I - point source"], ["level-2", "Level II - communal faucet"], ["level-3", "Level III - individual connection"], ["other", "Other"]]} />{profile.waterSource === "other" && <Field label="Other water source" value={profile.waterSourceOther} onChange={(value) => update("waterSourceOther", value)} maxLength={100} />}
        <SelectField label="Toilet type" value={profile.toiletType} onChange={(value) => update("toiletType", value)} options={[["", "Select"], ["A", "A - Flush, septic tank"], ["B", "B - Flush, sewerage"], ["C", "C - Ventilated pit latrine"], ["D", "D - Water-sealed toilet"], ["E", "E - Overhung latrine"], ["F", "F - Open pit latrine"], ["G", "G - No toilet"]]} />
        <SelectField label="Waste disposal" value={profile.wasteMethod} onChange={(value) => update("wasteMethod", value)} options={[["", "Select"], ["A", "A - Segregation"], ["B", "B - Composting"], ["C", "C - Recycling"], ["D", "D - Municipal collection"], ["E", "E - Other"]]} /><SelectField label="Blind drainage" value={profile.blindDrainage} onChange={(value) => update("blindDrainage", value)} options={yesNo} />
      </div><fieldset className="household-hazards"><legend>Hazardous area</legend>{[["storm-surge", "Storm surge"], ["flood", "Flood"], ["landslide", "Landslide"], ["other", "Other"]].map(([value, label]) => <label key={value}><input type="checkbox" checked={profile.hazards.includes(value)} onChange={(event) => update("hazards", event.target.checked ? [...profile.hazards, value] : profile.hazards.filter((entry) => entry !== value))} />{label}</label>)}{profile.hazards.includes("other") && <Field label="Other hazard" value={profile.hazardOther} onChange={(value) => update("hazardOther", value)} maxLength={100} />}</fieldset></fieldset>
      <fieldset className="household-section"><legend>Member health details</legend>{profile.members.map((member, index) => <details className="household-member" key={member.id}><summary><strong>{index + 1}. {member.surname}, {member.firstName}</strong><span>PhilHealth, nutrition, and health</span></summary><div className="household-member-body household-grid three">
        <Field label="PhilHealth ID" value={member.philhealthId} onChange={(value) => updateMember(member.id, "philhealthId", value)} maxLength={60} /><SelectField label="Membership type" value={member.membershipType} onChange={(value) => updateMember(member.id, "membershipType", value)} options={membershipOptions} /><SelectField label="Nutrition status (0-59 months)" value={member.nutritionStatus} onChange={(value) => updateMember(member.id, "nutritionStatus", value)} options={nutritionOptions} />
        <SelectField label="Sexually active" value={member.sexuallyActive} onChange={(value) => updateMember(member.id, "sexuallyActive", value)} options={yesNoNa} /><DateField label="Last menstrual period" value={member.lastMenstrualPeriod} onChange={(value) => updateMember(member.id, "lastMenstrualPeriod", value)} attempted={attempted} /><SelectField label="Family planning method" value={member.familyPlanningMethod} onChange={(value) => updateMember(member.id, "familyPlanningMethod", value)} options={familyPlanningOptions} />
        {([["cancer", "Cancer"], ["mentalHealth", "Mental health condition"], ["hypertension", "Hypertension"], ["diabetes", "Diabetes"], ["tbDots", "TB-DOTS"]] as [keyof HouseholdMember, string][]).map(([key, label]) => <SelectField key={key} label={label} value={String(member[key])} onChange={(value) => updateMember(member.id, key, value)} options={yesNoNa} />)}
        <Field label="Health remarks" value={member.healthRemarks} onChange={(value) => updateMember(member.id, "healthRemarks", value)} maxLength={240} />
      </div></details>)}</fieldset>
      <fieldset className="household-section"><legend>Interview and review</legend><div className="household-grid four"><Field label="Interviewed by" value={profile.interviewedBy} onChange={(value) => update("interviewedBy", value)} maxLength={120} /><Field label="Reviewed by" value={profile.reviewedBy} onChange={(value) => update("reviewedBy", value)} maxLength={120} /><Field label="Encoded by" value={profile.encodedBy} onChange={(value) => update("encodedBy", value)} maxLength={120} /><DateField label="Date encoded" value={profile.dateEncoded} onChange={(value) => update("dateEncoded", value)} attempted={attempted} /></div></fieldset>
    </div>}
    <div className="household-editor-actions"><Link href="/worker-portfolio" className="secondary-button">Cancel</Link>{step === 2 && <button type="button" className="secondary-button" onClick={() => goToStep(1)}>Previous page</button>}{step === 1 ? <button type="button" className="primary-button" onClick={() => goToStep(2)}>Continue to page 2</button> : <button type="button" className="primary-button" onClick={save} disabled={saving}>{saving ? "Saving..." : existing ? "Save changes" : "Save household"}</button>}</div>
  </section>;
}
