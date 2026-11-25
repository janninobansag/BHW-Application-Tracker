import { effectiveHouseholds, queueWorkerHousehold, queueWorkerHouseholdDelete } from "/worker-offline-store.js";
import { classificationOptions, civilStatusOptions, covidOptions, educationOptions, familyPlanningOptions, incomeOptions, membershipOptions, nipOptions, nutritionOptions, relationshipOptions, religionOptions } from "/household-options.js";

const node = (tag, className = "", text = "") => { const item = document.createElement(tag); item.className = className; item.textContent = text; return item; };
const createMember = () => ({ id: crypto.randomUUID(), surname: "", firstName: "", middleName: "", relationship: "", sex: "M", birthday: "", heightCm: "", weightKg: "", birthPlace: "", classifications: ["", "", "", ""], religion: "", civilStatus: "", education: "", nipStatus: "", covidStatus: "", profileRemarks: "", philhealthId: "", membershipType: "", nutritionStatus: "", sexuallyActive: "", lastMenstrualPeriod: "", familyPlanningMethod: "", cancer: "", mentalHealth: "", hypertension: "", diabetes: "", tbDots: "", healthRemarks: "" });
const createProfile = () => ({ barangayId: "", purokId: "", sitioId: "", householdNumber: "", respondent: { surname: "", firstName: "", middleName: "" }, respondentRelationship: "", visits: ["", "", "", ""], nhts: "", indigenous: "", tribe: "", headPhilhealth: "", headPhilhealthId: "", headPhilhealthCategory: "", income: "", renter: "", renterMonths: "", waterSource: "", waterSourceOther: "", toiletType: "", wasteMethod: "", blindDrainage: "", hazards: [], hazardOther: "", interviewedBy: "", reviewedBy: "", encodedBy: "", dateEncoded: "", members: [createMember()] });
const yesNo = [["", "Select"], ["yes", "Yes"], ["no", "No"]];
const yesNoNa = [...yesNo, ["na", "N/A"]];
const quarters = ["First quarter", "Second quarter", "Third quarter", "Fourth quarter"];
const todayInManila = () => { const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); const value = (type) => parts.find((part) => part.type === type)?.value || ""; return `${value("year")}-${value("month")}-${value("day")}`; };
const home = "/offline.html?view=portfolio";
const detail = (id) => `/offline.html?view=portfolio&record=${encodeURIComponent(id)}`;

function field(host, label, value, change, options = null, settings = {}) {
  const wrap = node("div", "household-field");
  const id = `household-${crypto.randomUUID()}`;
  const title = node("label", "", label); title.htmlFor = id;
  if (settings.required) { const mark = node("span", "household-required-mark", " *"); mark.setAttribute("aria-hidden", "true"); title.append(mark); }
  const control = document.createElement(options ? "select" : "input"); control.id = id;
  if (options) { const choices = value && !options.some(([key]) => key === value) ? [...options, [value, `Previously entered: ${value}`]] : options; for (const [key, caption] of choices) { const option = node("option", "", caption); option.value = key; control.append(option); } }
  else { control.type = settings.type || "text"; if (settings.inputMode) control.inputMode = settings.inputMode; if (settings.maxLength) control.maxLength = settings.maxLength; }
  control.value = value || ""; control.required = !!settings.required;
  control.addEventListener("input", () => change(control.value));
  wrap.append(title, control); host.append(wrap); return control;
}

function dateField(host, label, value, change, required = false) {
  const wrap = node("div", "household-field"); const id = `household-${crypto.randomUUID()}`;
  const title = node("label", "", label); title.htmlFor = id;
  if (required) { const mark = node("span", "household-required-mark", " *"); mark.setAttribute("aria-hidden", "true"); title.append(mark); }
  const row = node("div", "household-date"); const input = document.createElement("input"); input.id = id; input.type = "text"; input.inputMode = "numeric"; input.placeholder = "MM/DD/YYYY"; input.required = required; input.dataset.householdDate = "true";
  const show = (iso) => iso ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}` : "";
  input.value = show(value);
  const calendar = document.createElement("input"); calendar.type = "date"; calendar.value = value || ""; calendar.max = todayInManila(); calendar.setAttribute("aria-label", `Choose ${label.toLowerCase()} from calendar`);
  input.addEventListener("input", () => { const digits = input.value.replace(/\D/g, "").slice(0, 8); input.value = digits.length > 4 ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}` : digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits; const iso = digits.length === 8 ? `${digits.slice(4)}-${digits.slice(0, 2)}-${digits.slice(2, 4)}` : ""; const date = iso ? new Date(`${iso}T00:00:00Z`) : null; const valid = date && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso && iso <= calendar.max; change(valid ? iso : ""); calendar.value = valid ? iso : ""; input.setCustomValidity(input.value && !valid ? "Enter a valid date as MM/DD/YYYY." : ""); });
  calendar.addEventListener("input", () => { input.value = show(calendar.value); input.setCustomValidity(""); change(calendar.value); input.dispatchEvent(new Event("change", { bubbles: true })); });
  row.append(input, calendar); wrap.append(title, row); host.append(wrap);
}

function section(host, title) { const group = node("fieldset", "household-section"); const legend = node("legend", "", title); group.append(legend); host.append(group); return group; }
function grid(host, columns = "three") { const item = node("div", `household-grid ${columns}`); host.append(item); return item; }
function link(href, label, className = "secondary-button") { const item = node("a", className, label); item.href = href; return item; }
function button(label, onClick, className = "secondary-button") { const item = node("button", className, label); item.type = "button"; item.addEventListener("click", onClick); return item; }

function relationshipField(host, label, value, change, required = false) {
  let current = value || "";
  const group = node("div", "household-relationship"); host.append(group);
  const otherHost = node("div");
  const selected = () => current.startsWith("Other:") || Boolean(current && !relationshipOptions.some(([key]) => key === current));
  field(group, label, selected() ? "other" : current, (next) => { current = next === "other" ? "Other: " : next; change(current); renderOther(); }, relationshipOptions, { required });
  group.append(otherHost);
  function renderOther() { otherHost.replaceChildren(); if (selected()) field(otherHost, "Specify relationship", current.startsWith("Other:") ? current.slice(6).trimStart() : current, (next) => { current = `Other: ${next}`; change(current); }, null, { required: true, maxLength: 53 }); }
  renderOther();
}

function religionField(host, value, change) {
  let current = value || "";
  const group = node("div", "household-relationship"); host.append(group);
  const otherHost = node("div");
  const other = () => current === "6" || current.startsWith("6:");
  field(group, "Religion", other() ? "6" : current, (next) => { current = next === "6" ? "6: " : next; change(current); renderOther(); }, religionOptions);
  group.append(otherHost);
  function renderOther() { otherHost.replaceChildren(); if (other()) field(otherHost, "Specify religion", current.startsWith("6:") ? current.slice(2).trimStart() : "", (next) => { current = `6: ${next}`; change(current); }, null, { required: true, maxLength: 77 }); }
  renderOther();
}

function classificationField(host, label, value, change) {
  const wrap = node("div", "household-field household-classification"); wrap.append(node("span", "household-code-label", label));
  const picker = node("details", "household-code-picker"); const selected = new Set((value || "").split(/\s+/).filter(Boolean));
  const summary = node("summary", "", selected.size ? [...selected].join(" · ") : "Choose classifications"); const options = node("div", "household-code-options");
  const choices = [...classificationOptions, ...[...selected].filter((code) => !classificationOptions.some(([key]) => key === code)).map((code) => [code, `Previously entered: ${code}`])];
  for (const [code, caption] of choices) { const labelNode = node("label"); const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = selected.has(code); checkbox.addEventListener("change", () => { if (checkbox.checked) selected.add(code); else selected.delete(code); summary.textContent = selected.size ? [...selected].join(" · ") : "Choose classifications"; change([...selected].join(" ")); }); labelNode.append(checkbox, document.createTextNode(caption)); options.append(labelNode); }
  picker.append(summary, options); wrap.append(picker, node("small", "", "Choose all that apply for this visit.")); host.append(wrap);
}

function confirmOfflineDelete(profile, onDelete) {
  const dialog = node("dialog", "household-confirm");
  const heading = node("h2", "", "Delete household?");
  const description = node("p", "", `Household ${profile.householdNumber} and its ${profile.members.length} member record${profile.members.length === 1 ? "" : "s"} will be removed from this device and deleted online when changes sync.`);
  const error = node("p", "household-error"); error.hidden = true; error.setAttribute("role", "alert");
  const actions = node("div", "household-editor-actions");
  const cancel = button("Cancel", () => dialog.close());
  const remove = button("Delete household", async () => {
    cancel.disabled = remove.disabled = true;
    try { await onDelete(); dialog.close(); } catch (reason) { error.textContent = reason instanceof Error ? reason.message : "Could not save deletion."; error.hidden = false; cancel.disabled = remove.disabled = false; }
  }, "household-delete-button");
  actions.append(cancel, remove); dialog.append(heading, description, error, actions);
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  document.body.append(dialog); dialog.showModal();
}

export function renderOfflineHouseholds(root, contents, route, onSaved) {
  if (!contents) { root.append(node("p", "notice", "Household profiles are not saved on this device yet. Connect once while signed in to prepare them.")); return; }
  const profiles = effectiveHouseholds(contents);
  if (!route.recordId) {
    const panel = node("section", "panel household-registry"); const header = node("div", "household-registry-header");
    const heading = node("div"); heading.append(node("p", "eyebrow", "Household register"), node("h2", "", `Profiles ${profiles.length}`)); header.append(heading, link(detail("new"), "+ New household", "primary-button")); panel.append(header);
    const filter = field(panel, "Search", "", () => {}, null, { type: "search" }); filter.placeholder = "Household number or respondent";
    const list = node("div", "household-list"); panel.append(list); root.append(panel);
    const draw = () => { list.replaceChildren(); const query = filter.value.trim().toLowerCase(); const visible = profiles.filter((item) => `${item.householdNumber} ${item.respondent.surname} ${item.respondent.firstName} ${item.barangay_name} ${item.purok_name}`.toLowerCase().includes(query));
      if (!visible.length) list.append(node("p", "empty-state", profiles.length ? "No matching households." : "No household profiles yet."));
      for (const profile of visible) { const card = node("article", "household-card"); const info = node("div", "household-card-main"); const name = node("div"); name.append(node("span", "household-number", `Household ${profile.householdNumber}`), node("h3", "", `${profile.respondent.surname}, ${profile.respondent.firstName}`), node("p", "", `${profile.barangay_name || ""} / ${profile.purok_name || ""}`)); info.append(name, node("span", "household-member-count", `${profile.members.length} members`)); card.append(info); const footer = node("div", "household-card-footer"); const actions = node("div", "household-card-actions"); actions.append(link(detail(profile.id), "Edit")); actions.append(button("Delete", () => confirmOfflineDelete(profile, async () => { await queueWorkerHouseholdDelete(profile.id, profile.updated_at || undefined); onSaved(); }), "household-delete-button")); footer.append(node("span", "", contents.pending.some((item) => item.id === profile.id) ? "Waiting to sync" : "Saved on this device"), actions); card.append(footer); list.append(card); }
    }; filter.addEventListener("input", draw); draw(); return;
  }

  const existing = route.recordId === "new" ? null : profiles.find((item) => item.id === route.recordId);
  if (route.recordId !== "new" && !existing) { root.append(node("p", "notice", "This household is not available on this device."), link(home, "Back to households")); return; }
  const profile = existing ? structuredClone(existing) : createProfile(); const panel = node("section", "panel household-editor"); root.append(panel);
  panel.append(link(home, "Back to households")); const heading = node("h2", "", existing ? "Edit household" : "Add household"); heading.tabIndex = -1; panel.append(heading, node("p", "household-required-note", "Fields marked * are required."));
  const status = node("p", "household-error"); status.hidden = true; status.setAttribute("role", "alert"); panel.append(status);
  const steps = node("nav", "household-steps"); steps.setAttribute("aria-label", "Profile pages"); panel.append(steps);
  const first = node("div", "household-step-body"), second = node("div", "household-step-body"); panel.append(first, second);
  const firstButton = button("1  Household and members", () => switchStep(1)); const secondButton = button("2  Health and environment", () => switchStep(2)); steps.append(firstButton, secondButton);
  const actions = node("div", "household-editor-actions"); panel.append(actions);
  const problem = (message) => { status.textContent = message; status.hidden = !message; };
  function updateFieldFeedback(control, force = false) {
    if (!force && control.dataset.householdChecked !== "true") return;
    control.dataset.householdChecked = "true";
    const wrap = control.closest(".household-field");
    if (!wrap) return;
    const invalid = !control.validity.valid;
    control.setAttribute("aria-invalid", String(invalid));
    wrap.querySelector(".household-required-mark")?.classList.toggle("is-missing", invalid && control.required);
    let message = wrap.querySelector(".household-field-error");
    if (!invalid) { message?.remove(); control.removeAttribute("aria-describedby"); return; }
    if (!message) { message = node("small", "household-field-error"); message.id = `${control.id}-error`; wrap.append(message); }
    const label = wrap.querySelector("label")?.firstChild?.textContent || "This field";
    message.textContent = control.dataset.householdDate === "true" && control.value ? "Enter a valid date as MM/DD/YYYY." : `${label} is required.`;
    control.setAttribute("aria-describedby", message.id);
  }
  panel.addEventListener("input", (event) => { if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) updateFieldFeedback(event.target); });
  panel.addEventListener("change", (event) => { if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) updateFieldFeedback(event.target); });
  function validateFields(host) {
    const controls = host.querySelectorAll("input[required], select[required], input[data-household-date]");
    let firstInvalid = null;
    for (const control of controls) { updateFieldFeedback(control, true); if (!control.validity.valid && !firstInvalid) firstInvalid = control; }
    if (firstInvalid) { const details = firstInvalid.closest("details"); if (details) details.open = true; firstInvalid.focus(); }
    return !firstInvalid;
  }
  function switchStep(next) { problem(""); if (next === 2 && renderedHealthKey !== profile.members.map((item) => item.id).join("|")) buildHealth(); first.hidden = next !== 1; second.hidden = next !== 2; firstButton.setAttribute("aria-current", next === 1 ? "step" : "false"); secondButton.setAttribute("aria-current", next === 2 ? "step" : "false"); actions.replaceChildren(link(home, "Cancel")); if (next === 1) actions.append(button("Continue to page 2", () => { if (!validateFields(first)) return; switchStep(2); }, "primary-button")); else actions.append(button("Previous page", () => switchStep(1)), button("Save household", save, "primary-button")); heading.focus(); }

  let location = grid(section(first, "Location and household"));
  const purokGroup = node("div", "household-field"); const sitioGroup = node("div", "household-field");
  const updateLocations = () => { purokGroup.replaceChildren(); sitioGroup.replaceChildren(); const purokControl = field(purokGroup, "Purok", profile.purokId, (value) => { profile.purokId = value; }, [["", "Select a Purok"], ...contents.snapshot.puroks.filter((item) => item.barangay_id === profile.barangayId).map((item) => [item.id, item.name])], { required: true }); const sitioControl = field(sitioGroup, "Sitio", profile.sitioId, (value) => { profile.sitioId = value; }, [["", "Not specified"], ...(contents.snapshot.sitios || []).filter((item) => item.barangay_id === profile.barangayId).map((item) => [item.id, item.name])]); purokControl.disabled = sitioControl.disabled = !profile.barangayId; };
  field(location, "Barangay", profile.barangayId, (value) => { profile.barangayId = value; profile.purokId = ""; profile.sitioId = ""; updateLocations(); }, [["", "Select a Barangay"], ...contents.snapshot.barangays.map((item) => [item.id, item.name])], { required: true }); location.append(purokGroup, sitioGroup); updateLocations();
  field(location, "Household number / address", profile.householdNumber, (value) => { profile.householdNumber = value; }, null, { required: true, maxLength: 80 }); field(location, "Monthly income group", profile.income, (value) => { profile.income = value; }, incomeOptions);
  const visits = grid(section(first, "Quarterly visits"), "four"); quarters.forEach((label, index) => dateField(visits, label, profile.visits[index], (value) => { profile.visits[index] = value; }));
  const respondent = grid(section(first, "Respondent and household status"));
  for (const [key, label, required] of [["surname", "Respondent surname", true], ["firstName", "First name", true], ["middleName", "Middle name", false]]) field(respondent, label, profile.respondent[key], (value) => { profile.respondent[key] = value; }, null, { required, maxLength: 100 });
  relationshipField(respondent, "Relationship to household head", profile.respondentRelationship, (value) => { profile.respondentRelationship = value; });
  field(respondent, "NHTS household", profile.nhts, (value) => { profile.nhts = value; }, [["", "Select"], ["nhts-4ps", "NHTS 4Ps"], ["nhts-non4ps", "NHTS non-4Ps"], ["non-nhts", "Non-NHTS"]]); field(respondent, "Indigenous household", profile.indigenous, (value) => { profile.indigenous = value; }, [["", "Select"], ["ip", "IP"], ["non-ip", "Non-IP"]]); field(respondent, "Tribe", profile.tribe, (value) => { profile.tribe = value; }); field(respondent, "HH head PhilHealth registered", profile.headPhilhealth, (value) => { profile.headPhilhealth = value; }, yesNo); field(respondent, "PhilHealth ID", profile.headPhilhealthId, (value) => { profile.headPhilhealthId = value; }); field(respondent, "PhilHealth category", profile.headPhilhealthCategory, (value) => { profile.headPhilhealthCategory = value; }, membershipOptions);
  const memberSection = section(first, "Household members"); const memberHost = node("div"); memberSection.append(memberHost); const add = button("+ Add member", () => { if (profile.members.length >= 10) return; profile.members.push(createMember()); buildMembers(); }, "secondary-button household-add"); memberSection.append(add);
  function buildMembers() { memberHost.replaceChildren(); add.hidden = profile.members.length >= 10; for (const [index, member] of profile.members.entries()) { const detailNode = node("details", "household-member"); if (index === profile.members.length - 1) detailNode.open = true; detailNode.append(node("summary", "", `${index + 1}. ${member.surname || member.firstName ? `${member.surname}, ${member.firstName}` : "New member"}`)); const body = grid(detailNode); memberHost.append(detailNode);
      for (const [key, label, required] of [["surname", "Surname", true], ["firstName", "First name", true], ["middleName", "Middle name", false]]) field(body, label, member[key], (value) => { member[key] = value; }, null, { required, maxLength: 100 });
      relationshipField(body, "Relationship to head", member.relationship, (value) => { member.relationship = value; }, true); field(body, "Sex", member.sex, (value) => { member.sex = value; }, [["M", "Male"], ["F", "Female"]]); dateField(body, "Birthday", member.birthday, (value) => { member.birthday = value; }, true);
      for (const [key, label] of [["heightCm", "Height (cm)"], ["weightKg", "Weight (kg)"], ["birthPlace", "Birth place"]]) field(body, label, member[key], (value) => { member[key] = value; });
      quarters.forEach((label, place) => classificationField(body, `${label} classification`, member.classifications[place], (value) => { member.classifications[place] = value; }));
      religionField(body, member.religion, (value) => { member.religion = value; });
      for (const [key, label, choices] of [["civilStatus", "Civil status", civilStatusOptions], ["education", "Education", educationOptions], ["nipStatus", "NIP vaccination", nipOptions], ["covidStatus", "COVID vaccination", covidOptions], ["profileRemarks", "Remarks", null]]) field(body, label, member[key], (value) => { member[key] = value; }, choices);
      if (profile.members.length > 1) detailNode.append(button("Remove member", () => { profile.members = profile.members.filter((item) => item.id !== member.id); buildMembers(); }, "household-remove"));
    } } buildMembers();

  const environment = grid(section(second, "Home and surroundings"));
  field(environment, "Renter", profile.renter, (value) => { profile.renter = value; }, yesNo); field(environment, "Months renting", profile.renterMonths, (value) => { profile.renterMonths = value; }, null, { inputMode: "numeric" }); field(environment, "Water source", profile.waterSource, (value) => { profile.waterSource = value; }, [["", "Select"], ["level-1", "Level I - point source"], ["level-2", "Level II - communal faucet"], ["level-3", "Level III - individual connection"], ["other", "Other"]]); field(environment, "Other water source", profile.waterSourceOther, (value) => { profile.waterSourceOther = value; });
  field(environment, "Toilet type", profile.toiletType, (value) => { profile.toiletType = value; }, [["", "Select"], ..."ABCDEFG".split("").map((value) => [value, value])]); field(environment, "Waste disposal", profile.wasteMethod, (value) => { profile.wasteMethod = value; }, [["", "Select"], ..."ABCDE".split("").map((value) => [value, value])]); field(environment, "Blind drainage", profile.blindDrainage, (value) => { profile.blindDrainage = value; }, yesNo);
  const hazards = section(second, "Hazardous area"); const hazardRows = node("div", "household-hazards"); hazards.append(hazardRows); for (const [value, label] of [["storm-surge", "Storm surge"], ["flood", "Flood"], ["landslide", "Landslide"], ["other", "Other"]]) { const row = node("label"); const input = document.createElement("input"); input.type = "checkbox"; input.checked = profile.hazards.includes(value); input.addEventListener("change", () => { profile.hazards = input.checked ? [...profile.hazards, value] : profile.hazards.filter((item) => item !== value); }); row.append(input, document.createTextNode(label)); hazardRows.append(row); } field(hazards, "Other hazard", profile.hazardOther, (value) => { profile.hazardOther = value; });
  const health = section(second, "Member health details"); let renderedHealthKey = ""; function buildHealth() { health.replaceChildren(node("legend", "", "Member health details")); renderedHealthKey = profile.members.map((item) => item.id).join("|"); for (const [index, member] of profile.members.entries()) { const detailNode = node("details", "household-member"); detailNode.append(node("summary", "", `${index + 1}. ${member.surname}, ${member.firstName}`)); const body = grid(detailNode); health.append(detailNode); field(body, "PhilHealth ID", member.philhealthId, (value) => { member.philhealthId = value; }); field(body, "Membership type", member.membershipType, (value) => { member.membershipType = value; }, membershipOptions); field(body, "Nutrition status (0-59 months)", member.nutritionStatus, (value) => { member.nutritionStatus = value; }, nutritionOptions); field(body, "Sexually active", member.sexuallyActive, (value) => { member.sexuallyActive = value; }, yesNoNa); dateField(body, "Last menstrual period", member.lastMenstrualPeriod, (value) => { member.lastMenstrualPeriod = value; }); field(body, "Family planning method", member.familyPlanningMethod, (value) => { member.familyPlanningMethod = value; }, familyPlanningOptions); for (const [key, label] of [["cancer", "Cancer"], ["mentalHealth", "Mental health condition"], ["hypertension", "Hypertension"], ["diabetes", "Diabetes"], ["tbDots", "TB-DOTS"]]) field(body, label, member[key], (value) => { member[key] = value; }, yesNoNa); field(body, "Health remarks", member.healthRemarks, (value) => { member.healthRemarks = value; }); } } buildHealth();
  const signoff = grid(section(second, "Interview and review")); for (const [key, label] of [["interviewedBy", "Interviewed by"], ["reviewedBy", "Reviewed by"], ["encodedBy", "Encoded by"]]) field(signoff, label, profile[key], (value) => { profile[key] = value; }); dateField(signoff, "Date encoded", profile.dateEncoded, (value) => { profile.dateEncoded = value; });

  async function save() { problem(""); if (!validateFields(first)) { switchStep(1); validateFields(first); return; } if (!validateFields(second)) return; try { await queueWorkerHousehold(profile, existing?.id || crypto.randomUUID(), existing?.updated_at || undefined); onSaved(); } catch (error) { problem(error.message || "Could not save on this device."); } }
  switchStep(1);
}
