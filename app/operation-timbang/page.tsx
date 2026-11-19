import { requireUser } from "@/Services/auth";
import { todayInManila } from "@/Services/child-records";
import { listBarangays, listPuroks, listSitios, listTimbangRecords } from "@/Data/repositories";
import { saveTimbangRecord } from "@/Client/controllers/actions";
import { AppShell } from "@/Client/views/components/shell";
import { ChildRegistry } from "@/Client/views/components/child-registry";
import { ChildAgeInput } from "@/Client/views/components/child-age-input";
import { ChildLocationFields } from "@/Client/views/components/child-location-fields";
import { TimbangMeasurements } from "@/Client/views/components/timbang-measurements";
import { FeedbackDialog } from "@/Client/views/components/feedback-dialog";
import { AutomaticWorkerRecords } from "@/Client/views/components/automatic-worker-records";

export const dynamic = "force-dynamic";
export const metadata = { title: "Operation Timbang | BHW Records" };

export default async function OperationTimbangPage({ searchParams }: { searchParams: Promise<{ q?: string; barangay?: string; purok?: string; age?: string; message?: string; feedbackError?: string; feedbackId?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const [barangays, puroks, sitios, records] = await Promise.all([listBarangays(user), listPuroks(user), listSitios(user), listTimbangRecords(user)]);
  const today = todayInManila();
  return <AppShell user={user} title="Operation Timbang" eyebrow="Child growth monitoring" contentClassName="timbang-content">
    {user.role === "bhw" && <AutomaticWorkerRecords program="timbang" snapshot={{ user: { id: user.id, username: user.username, display_name: user.display_name }, children: records, barangays, puroks, savedAt: new Date().toISOString() }} />}
    <FeedbackDialog message={params.message} isError={params.feedbackError === "1"} feedbackId={params.feedbackId} />
    <ChildRegistry key={records.map((record) => `${record.id}:${record.updated_at}`).join(",")} program="timbang" records={records} barangays={barangays} puroks={puroks} sitios={sitios} today={today} initialQuery={typeof params.q === "string" ? params.q.slice(0, 80) : ""} initialBarangayId={typeof params.barangay === "string" ? params.barangay : ""} initialPurokId={typeof params.purok === "string" ? params.purok : ""} initialAgeFilter={params.age === "under-5" || params.age === "over-60" ? params.age : ""}>
      <section className="panel form-panel">
        {barangays.length ? <form action={saveTimbangRecord} className="form-stack" data-record-program="timbang" data-offline-draft-form>
          <div className="field"><label htmlFor="name">Child&apos;s name</label><input id="name" name="name" maxLength={120} required /></div>
          <ChildAgeInput today={today} inputId="timbang-birthday" />
          <div className="field"><label htmlFor="sex">Sex</label><select id="sex" name="sex" required defaultValue=""><option value="" disabled>Select F or M</option><option value="F">F - Female</option><option value="M">M - Male</option></select></div>
          <div className="field"><label htmlFor="parents">Parent / guardian</label><input id="parents" name="parents" maxLength={240} required /></div>
          <TimbangMeasurements />
          <ChildLocationFields barangays={barangays} puroks={puroks} />
          <button className="primary-button" type="submit">Save Operation Timbang record</button>
        </form> : <p className="notice">Ask the administrator to assign your Barangay and Purok before adding a record.</p>}
      </section>
    </ChildRegistry>
  </AppShell>;
}
