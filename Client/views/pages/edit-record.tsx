import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/Services/auth";
import { todayInManila } from "@/Services/child-records";
import { listBarangays, listChildren, listPuroks } from "@/Data/repositories";
import { saveChild } from "@/Client/controllers/actions";
import { ChildAgeInput } from "@/Client/views/components/child-age-input";
import { ChildLocationFields } from "@/Client/views/components/child-location-fields";
import { AppShell } from "@/Client/views/components/shell";

export const dynamic = "force-dynamic";

export default async function EditRecord({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [barangays, puroks, records] = await Promise.all([listBarangays(user), listPuroks(user), listChildren(user)]);
  const child = records.find((row) => row.id === id);
  if (!child) notFound();
  return <AppShell user={user} title="Edit child record" eyebrow="Registry correction"><div className="edit-container"><section className="panel form-panel">
    <p className="muted">Correct the child&apos;s details below. Changes appear in the totals and CSV immediately.</p>
    <form action={saveChild} className="form-stack" data-offline-draft-form><input type="hidden" name="id" value={child.id} /><input type="hidden" name="updatedAt" value={child.updated_at ?? ""} />
      <div className="field"><label htmlFor="name">Child&apos;s name</label><input id="name" name="name" defaultValue={child.name} maxLength={120} required /></div>
      <ChildAgeInput initial={child.birthday} today={todayInManila()} inputId="edit-birthday" />
      <div className="field"><label htmlFor="sex">Sex</label><select id="sex" name="sex" defaultValue={child.sex} required><option value="F">F - Female</option><option value="M">M - Male</option></select></div>
      <div className="field"><label htmlFor="parents">Parents&apos; names</label><input id="parents" name="parents" defaultValue={child.parents} maxLength={240} required /></div>
      <ChildLocationFields barangays={barangays} puroks={puroks} initialBarangayId={child.barangay_id ?? ""} initialPurokId={child.purok_id ?? ""} />
      <div className="button-row"><button className="primary-button" type="submit">Save changes</button><Link className="secondary-button" href="/">Cancel</Link></div>
    </form>
  </section></div></AppShell>;
}
