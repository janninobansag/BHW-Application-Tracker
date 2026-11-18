import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/Services/auth";
import { todayInManila } from "@/Services/child-records";
import { listBarangays, listChildren, listPuroks } from "@/Data/repositories";
import { saveChild } from "@/Client/controllers/actions";
import { ChildAgeInput } from "@/Client/views/components/child-age-input";
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
    <form action={saveChild} className="form-stack"><input type="hidden" name="id" value={child.id} />
      <div className="field"><label htmlFor="name">Child&apos;s name</label><input id="name" name="name" defaultValue={child.name} maxLength={120} required /></div>
      <ChildAgeInput initial={child.birthday} today={todayInManila()} inputId="edit-birthday" />
      <div className="field"><label htmlFor="sex">Sex</label><select id="sex" name="sex" defaultValue={child.sex} required><option value="F">F — Female</option><option value="M">M — Male</option></select></div>
      <div className="field"><label htmlFor="parents">Parents&apos; names</label><input id="parents" name="parents" defaultValue={child.parents} maxLength={240} required /></div>
      <div className="field"><label htmlFor="barangayId">Barangay</label><select id="barangayId" name="barangayId" defaultValue={child.barangay_id} required>{barangays.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div className="field"><label htmlFor="purokId">Purok</label><select id="purokId" name="purokId" defaultValue={child.purok_id ?? ""} required>{puroks.map((item) => <option key={item.id} value={item.id}>{barangays.find((b) => b.id === item.barangay_id)?.name} — {item.name}</option>)}</select></div>
      <div className="button-row"><button className="primary-button" type="submit">Save changes</button><Link className="secondary-button" href="/">Cancel</Link></div>
    </form>
  </section></div></AppShell>;
}
