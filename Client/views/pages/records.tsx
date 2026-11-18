import { requireUser } from "@/Services/auth";
import { todayInManila } from "@/Services/child-records";
import { listBarangays, listChildren, listPuroks, listSitios } from "@/Data/repositories";
import { saveChild } from "@/Client/controllers/actions";
import { ChildAgeInput } from "@/Client/views/components/child-age-input";
import { ChildLocationFields } from "@/Client/views/components/child-location-fields";
import { ChildRegistry } from "@/Client/views/components/child-registry";
import { AppShell } from "@/Client/views/components/shell";
import { FeedbackDialog } from "@/Client/views/components/feedback-dialog";
import { OfflineAccessPanel } from "@/Client/views/components/offline-access-panel";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; barangay?: string; purok?: string; message?: string; feedbackError?: string; feedbackId?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 80) : "";
  const barangay = typeof params.barangay === "string" ? params.barangay : "";
  const purok = typeof params.purok === "string" ? params.purok : "";
  const [barangays, puroks, sitios, children] = await Promise.all([
    listBarangays(user),
    listPuroks(user),
    listSitios(user),
    listChildren(user),
  ]);
  const offlineChildren = user.role === "bhw" ? children : [];
  const today = todayInManila();
  return <AppShell user={user} title="Child records" eyebrow="Community health registry">
    <FeedbackDialog message={params.message} isError={params.feedbackError === "1"} feedbackId={params.feedbackId} />
    {user.role === "bhw" && <OfflineAccessPanel snapshot={{
      user: { id: user.id, username: user.username, display_name: user.display_name },
      children: offlineChildren,
      barangays,
      puroks,
      savedAt: new Date().toISOString(),
    }} />}
    <ChildRegistry records={children} barangays={barangays} puroks={puroks} sitios={sitios} today={today} initialQuery={q} initialBarangayId={barangay} initialPurokId={purok}>
      <section className="panel form-panel"><p className="eyebrow">New record</p><h2>Add a child</h2><p className="muted">Keep names and birthdays accurate for monthly reporting.</p>
        {barangays.length ? <form action={saveChild} className="form-stack" data-offline-draft-form>
          <div className="field"><label htmlFor="name">Child&apos;s name</label><input id="name" name="name" maxLength={120} required /></div>
          <ChildAgeInput today={today} />
          <div className="field"><label htmlFor="sex">Sex</label><select id="sex" name="sex" required defaultValue=""><option value="" disabled>Select F or M</option><option value="F">F - Female</option><option value="M">M - Male</option></select></div>
          <div className="field"><label htmlFor="parents">Parents&apos; names</label><input id="parents" name="parents" maxLength={240} required /></div>
          <ChildLocationFields barangays={barangays} puroks={puroks} />
          <button className="primary-button" type="submit">Save child record</button>
        </form> : <p className="notice">No barangay is assigned to your account. Ask the administrator to assign one.</p>}
      </section>
    </ChildRegistry>
  </AppShell>;
}
