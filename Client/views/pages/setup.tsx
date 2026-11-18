import { redirect } from "next/navigation";
import { isSetupComplete } from "@/Data/repositories";
import { setupAdmin } from "@/Client/controllers/actions";
import { FeedbackDialog } from "@/Client/views/components/feedback-dialog";
import { PasswordInput } from "@/Client/views/components/password-input";

export const dynamic = "force-dynamic";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ message?: string; feedbackError?: string; feedbackId?: string }> }) {
  if (await isSetupComplete()) redirect("/login");
  const { message, feedbackError, feedbackId } = await searchParams;
  return <main className="auth-page setup-page"><div className="auth-panel">
    <FeedbackDialog message={message} isError={feedbackError === "1"} feedbackId={feedbackId} />
    <div className="auth-brand"><span className="brand-mark">✚</span><span><strong>BHW Records</strong><small>Barangay health desk</small></span></div>
    <p className="eyebrow">One-time secure setup</p><h1>Set the Admin password</h1>
    <p className="muted">Enter the one-time setup token configured for the backend, then choose the Admin password.</p>
    <form action={setupAdmin} className="form-stack">
      <div className="field"><label htmlFor="setupToken">One-time setup token</label><PasswordInput id="setupToken" name="setupToken" autoComplete="off" required /></div>
      <div className="field"><label htmlFor="password">Admin password</label><PasswordInput id="password" name="password" minLength={12} maxLength={128} autoComplete="new-password" required /><small className="field-hint">Use 12-128 characters.</small></div>
      <div className="field"><label htmlFor="confirm">Confirm password</label><PasswordInput id="confirm" name="confirm" minLength={12} maxLength={128} autoComplete="new-password" required /></div>
      <button className="primary-button" type="submit">Activate Admin account</button>
    </form>
    <p className="auth-footnote">Keep the site owner-only until this step is complete.</p>
  </div><div className="auth-side"><div><span className="auth-side-icon">✚</span><h2>Your health desk starts here.</h2><p>After setup, sign in as Admin to manage workers and their assigned barangays.</p></div></div></main>;
}
