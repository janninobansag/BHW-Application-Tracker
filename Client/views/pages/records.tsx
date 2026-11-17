import Link from "next/link";
import { requireUser } from "@/Services/auth";
import { ageInMonths, todayInManila } from "@/Services/child-records";
import { listBarangays, listChildren } from "@/Data/repositories";
import { saveChild } from "@/Client/controllers/actions";
import { ChildAgeInput } from "@/Client/views/components/child-age-input";
import { AppShell } from "@/Client/views/components/shell";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; barangay?: string; message?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 80) : "";
  const barangay = typeof params.barangay === "string" ? params.barangay : "";
  const [barangays, children] = await Promise.all([listBarangays(user), listChildren(user, q, barangay)]);
  const today = todayInManila();
  const male = children.filter((child) => child.sex === "M").length;
  const female = children.filter((child) => child.sex === "F").length;
  const csvQuery = new URLSearchParams({ q, barangay }).toString();
  return <AppShell user={user} title="Child records" eyebrow="Community health registry">
    {params.message && <p className="notice" role="status">{params.message}</p>}
    <div className="stats-grid" aria-label="Record totals">
      <div className="stat"><span>Total children</span><strong>{children.length}</strong><small>In the current view</small></div>
      <div className="stat"><span>Male</span><strong>{male}</strong><small>Recorded as M</small></div>
      <div className="stat"><span>Female</span><strong>{female}</strong><small>Recorded as F</small></div>
    </div>
    <div className="workspace-grid">
      <section className="panel record-panel"><div className="section-heading"><div><p className="eyebrow">Registry</p><h2>Children in your care</h2></div><a className="secondary-button" href={`/api/export?${csvQuery}`}>Download CSV</a></div>
        <form method="get" className="filters" aria-label="Filter child records">
          <div className="field"><label htmlFor="q">Search</label><input id="q" name="q" placeholder="Child or parent name" defaultValue={q} /></div>
          <div className="field"><label htmlFor="barangay">Barangay</label><select id="barangay" name="barangay" defaultValue={barangay}><option value="">All assigned barangays</option>{barangays.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <button className="filter-button" type="submit">Apply</button>
        </form>
        {children.length ? <div className="table-scroll"><table><thead><tr><th>Child</th><th>Age</th><th>Sex</th><th>Parents</th><th>Barangay / BHW</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>
          {children.map((child) => <tr key={child.id}><td><strong>{child.name}</strong><small>{child.birthday}</small></td><td>{ageInMonths(child.birthday, today)} months</td><td><span className="sex-pill">{child.sex}</span></td><td>{child.parents}</td><td><strong>{child.barangay_name}</strong><small>{child.bhw_names || "Unassigned"}</small></td><td><Link className="table-link" href={`/records/${encodeURIComponent(child.id)}`}>Edit</Link></td></tr>)}
        </tbody></table></div> : <div className="empty-state"><strong>No children found</strong><p>{q || barangay ? "Try another search or barangay filter." : "Add the first child record using the form."}</p></div>}
        <p className="table-note">Ages use full months as of {today}. Counts and CSV match the current filters.</p>
      </section>
      <section className="panel form-panel"><p className="eyebrow">New record</p><h2>Add a child</h2><p className="muted">Keep names and birthdays accurate for monthly reporting.</p>
        {barangays.length ? <form action={saveChild} className="form-stack">
          <div className="field"><label htmlFor="name">Child&apos;s name</label><input id="name" name="name" maxLength={120} required /></div>
          <ChildAgeInput today={today} />
          <div className="field"><label htmlFor="sex">Sex</label><select id="sex" name="sex" required defaultValue=""><option value="" disabled>Select F or M</option><option value="F">F — Female</option><option value="M">M — Male</option></select></div>
          <div className="field"><label htmlFor="parents">Parents&apos; names</label><input id="parents" name="parents" maxLength={240} required /></div>
          <div className="field"><label htmlFor="barangayId">Barangay</label><select id="barangayId" name="barangayId" required defaultValue=""><option value="" disabled>Select a barangay</option>{barangays.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <button className="primary-button" type="submit">Save child record</button>
        </form> : <p className="notice">No barangay is assigned to your account. Ask the administrator to assign one.</p>}
      </section>
    </div>
  </AppShell>;
}
