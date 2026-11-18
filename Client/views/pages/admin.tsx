import { requireAdmin } from "@/Services/auth";
import { listBarangays, listManagedUsers, listPuroks } from "@/Data/repositories";
import { createBhw } from "@/Client/controllers/actions";
import { AppShell } from "@/Client/views/components/shell";
import { CoverageManager } from "@/Client/views/components/coverage-manager";
import { BhwAccountList } from "@/Client/views/components/bhw-account-list";
import { FeedbackDialog } from "@/Client/views/components/feedback-dialog";
import { PasswordInput } from "@/Client/views/components/password-input";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ message?: string; feedbackError?: string; feedbackId?: string; assignmentUserId?: string; assignmentMessage?: string; assignmentError?: string }> }) {
  const admin = await requireAdmin();
  const [barangays, puroks, users] = await Promise.all([listBarangays(admin), listPuroks(admin), listManagedUsers()]);
  const { message, feedbackError, feedbackId, assignmentMessage, assignmentError } = await searchParams;
  const safeUsers = users.map(({ id, username, display_name, is_active, assigned_ids, assigned_purok_ids }) => ({ id, username, display_name, is_active, assigned_ids, assigned_purok_ids }));
  return <AppShell user={admin} title="Administration" eyebrow="Team and coverage">
    <FeedbackDialog message={message ?? assignmentMessage} isError={feedbackError === "1" || assignmentError === "1"} feedbackId={feedbackId ?? assignmentMessage} />
    <div className="admin-intro"><div><h2>Manage your health workers</h2><p>Assign barangays, issue temporary passwords, and deactivate accounts when access should end.</p></div><div className="admin-number"><strong>{users.filter((user) => user.is_active).length}</strong><span>active BHWs</span></div></div>
    <div className="admin-grid">
      <BhwAccountList accounts={safeUsers} barangays={barangays} puroks={puroks} />
      <div className="admin-side">
        <section className="panel form-panel"><p className="eyebrow">Add staff</p><h2>Create BHW account</h2><p className="muted">The worker changes their temporary password at first sign-in.</p><form action={createBhw} className="form-stack">
          <div className="field"><label htmlFor="displayName">Worker name</label><input id="displayName" name="displayName" maxLength={100} required /></div>
          <div className="field"><label htmlFor="username">Username</label><input id="username" name="username" pattern="[A-Za-z0-9._-]{3,40}" maxLength={40} autoComplete="off" required /></div>
          <div className="field"><label htmlFor="temporaryPassword">Temporary password</label><PasswordInput id="temporaryPassword" name="temporaryPassword" minLength={12} maxLength={128} autoComplete="new-password" required /></div>
          <button className="primary-button" type="submit">Create account</button>
        </form></section>
        <CoverageManager barangays={barangays} puroks={puroks} />
      </div>
    </div>
  </AppShell>;
}
