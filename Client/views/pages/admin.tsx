import { requireAdmin } from "@/Services/auth";
import { listBarangays, listManagedUsers, listPuroks, listSitios } from "@/Data/repositories";
import { createBhw } from "@/Client/controllers/actions";
import { AppShell } from "@/Client/views/components/shell";
import { CoverageManager } from "@/Client/views/components/coverage-manager";
import { BhwAccountList } from "@/Client/views/components/bhw-account-list";
import { FeedbackDialog } from "@/Client/views/components/feedback-dialog";
import { PasswordInput } from "@/Client/views/components/password-input";
import { CreateWorkerDialog } from "@/Client/views/components/create-worker-dialog";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ message?: string; feedbackError?: string; feedbackId?: string; assignmentUserId?: string; assignmentMessage?: string; assignmentError?: string; status?: string }> }) {
  const admin = await requireAdmin();
  const [barangays, puroks, sitios, users] = await Promise.all([listBarangays(admin), listPuroks(admin), listSitios(admin), listManagedUsers()]);
  const { message, feedbackError, feedbackId, assignmentMessage, assignmentError, status } = await searchParams;
  const initialStatus = ["active", "inactive", "unassigned"].includes(status ?? "") ? status : "all";
  const safeUsers = users.map(({ id, username, display_name, is_active, assigned_ids, assigned_purok_ids }) => ({ id, username, display_name, is_active, assigned_ids, assigned_purok_ids }));
  return <AppShell user={admin} title="Administration" eyebrow="Team and coverage">
    <FeedbackDialog message={message ?? assignmentMessage} isError={feedbackError === "1" || assignmentError === "1"} feedbackId={feedbackId ?? assignmentMessage} />
    <div className="admin-intro"><div><p className="eyebrow">Team overview</p><h2>People behind the care</h2><p>Manage worker access and keep community assignments up to date.</p></div><dl className="admin-overview-totals"><div><dt>Active workers</dt><dd>{users.filter((user) => user.is_active).length}</dd></div><div><dt>Barangays</dt><dd>{barangays.length}</dd></div></dl></div>
    <div className="admin-grid">
      <BhwAccountList key={initialStatus} accounts={safeUsers} barangays={barangays} puroks={puroks} initialStatus={initialStatus} />
      <div className="admin-side">
        <CreateWorkerDialog><form action={createBhw} className="form-stack">
          <div className="field"><label htmlFor="displayName">Worker name</label><input id="displayName" name="displayName" maxLength={100} required /></div>
          <div className="field"><label htmlFor="username">Username</label><input id="username" name="username" pattern="[A-Za-z0-9._-]{3,40}" maxLength={40} autoComplete="off" required /></div>
          <div className="field"><label htmlFor="temporaryPassword">Temporary password</label><PasswordInput id="temporaryPassword" name="temporaryPassword" minLength={12} maxLength={128} autoComplete="new-password" required /></div>
          <button className="primary-button" type="submit">Create account</button>
        </form></CreateWorkerDialog>
        <CoverageManager barangays={barangays} puroks={puroks} sitios={sitios} />
      </div>
    </div>
  </AppShell>;
}
