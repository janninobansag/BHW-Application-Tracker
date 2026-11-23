import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/Services/auth";
import { ageInMonths, todayInManila } from "@/Services/child-records";
import { ArrowLeft, ClipboardCheck, UserRound } from "lucide-react";
import { listBarangays, listChildren, listPuroks, listTimbangRecords } from "@/Data/repositories";
import type { TimbangRecord } from "@/Data/entities";
import { saveChild, saveTimbangRecord } from "@/Client/controllers/actions";
import { TimbangMeasurements } from "@/Client/views/components/timbang-measurements";
import { ChildAgeInput } from "@/Client/views/components/child-age-input";
import { ChildLocationFields } from "@/Client/views/components/child-location-fields";
import { ChildNameFields } from "@/Client/views/components/child-name-fields";
import { AppShell } from "@/Client/views/components/shell";
import { AutomaticWorkerRecords } from "@/Client/views/components/automatic-worker-records";
import { displayChildName, splitChildName } from "@/public/child-name.js";

export const dynamic = "force-dynamic";

export default async function EditRecord({ params, program = "deworming" }: { params: Promise<{ id: string }>; program?: "deworming" | "timbang" }) {
  const timbang = program === "timbang";
  const returnTo = timbang ? "/operation-timbang" : "/";
  const user = await requireUser();
  const { id } = await params;
  const [barangays, puroks, records] = await Promise.all([listBarangays(user), listPuroks(user), timbang ? listTimbangRecords(user) : listChildren(user)]);
  const child = records.find((row) => row.id === id);
  if (!child) notFound();
  const today = todayInManila();
  const age = ageInMonths(child.birthday, today);
  const childName = splitChildName(child.name, child.surname, child.middle_initial, child.first_name);
  const birthday = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }).format(new Date(`${child.birthday}T12:00:00Z`));
  return <AppShell user={user} title={timbang ? "Edit Operation Timbang record" : "Edit child record"} eyebrow="Registry correction" contentClassName="record-edit-content">
    <Link href={returnTo} className="record-edit-back"><ArrowLeft aria-hidden="true" />Back to registry</Link>
    <div className="edit-container record-edit-layout"><section className="panel form-panel record-edit-form-panel">
    <div className="record-edit-form-heading"><h2>Update child details</h2><p>Keep personal information and community assignments accurate. Saved changes update the registry and future Excel exports.</p></div>
    {user.role === "bhw" && <AutomaticWorkerRecords program={program} snapshot={{ user: { id: user.id, username: user.username, display_name: user.display_name }, children: records, barangays, puroks, savedAt: new Date().toISOString() }} />}
    <form action={timbang ? saveTimbangRecord : saveChild} className="form-stack record-edit-form" data-offline-draft-form data-record-program={program}><input type="hidden" name="id" value={child.id} /><input type="hidden" name="updatedAt" value={child.updated_at ?? ""} />
      <fieldset className="record-edit-fields"><legend>Personal information</legend>
      <ChildNameFields initial={childName} />
      <ChildAgeInput initial={child.birthday} today={today} inputId="edit-birthday" />
      <div className="field"><label htmlFor="sex">Sex</label><select id="sex" name="sex" defaultValue={child.sex} required><option value="F">F - Female</option><option value="M">M - Male</option></select></div>
      <div className="field record-edit-full"><label htmlFor="parents">Parents&apos; names</label><input id="parents" name="parents" defaultValue={child.parents} maxLength={240} required /></div>
      </fieldset>
      {timbang && <TimbangMeasurements record={child as TimbangRecord} />}
      <ChildLocationFields barangays={barangays} puroks={puroks} initialBarangayId={child.barangay_id ?? ""} initialPurokId={child.purok_id ?? ""} />
      <div className="record-edit-footer"><Link className="secondary-button" href={returnTo}>Cancel</Link><button className="primary-button" type="submit">Save changes</button></div>
    </form>
  </section><aside className="record-edit-aside" aria-label="Saved record information">
    <section className="panel record-summary"><p className="eyebrow">Saved record</p><div className="record-summary-heading"><span className="record-summary-avatar"><UserRound aria-hidden="true" /></span><div><h2>{displayChildName(child.name, child.surname, child.middle_initial, child.first_name)}</h2><p>Details before your edits</p></div></div>
      <div className="record-summary-metrics"><div><span>Current age</span><strong>{age} <small>{age === 1 ? "month" : "months"}</small></strong></div><div><span>Sex</span><strong className={`record-summary-sex ${child.sex === "F" ? "sex-pill-female" : "sex-pill-male"}`}>{child.sex === "F" ? "Female" : "Male"}</strong></div></div>
      <dl className="record-summary-details"><div><dt>Date of birth</dt><dd>{birthday}</dd></div><div><dt>Parent / guardian</dt><dd>{child.parents}</dd></div><div><dt>Barangay</dt><dd>{child.barangay_name}</dd></div><div><dt>Purok</dt><dd>{child.purok_name || "Purok not specified"}</dd></div><div><dt>Health worker</dt><dd>{child.bhw_names || "Unassigned"}</dd></div>{timbang && ([['weight', 'Weight', 'kg'], ['height', 'Height', 'cm'], ['muac', 'MUAC', 'cm']] as const).map(([field, label, unit]) => <div key={field}><dt>{label}</dt><dd>{(child as TimbangRecord)[field] == null ? "Not measured" : `${(child as TimbangRecord)[field]} ${unit}`}</dd></div>)}</dl>
    </section>
    <section className="record-edit-review"><div><ClipboardCheck aria-hidden="true" /><h2>Before you save</h2></div><p>Confirm the child&apos;s name and birthday, then check the Barangay and Purok. Age is calculated automatically from the birthday.</p></section>
  </aside></div></AppShell>;
}
