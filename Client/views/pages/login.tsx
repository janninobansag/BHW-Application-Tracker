import { redirect } from "next/navigation";
import { getCurrentUser } from "@/Services/auth";
import { isSetupComplete } from "@/Data/repositories";
import { login } from "@/Client/controllers/actions";
import { BrandIcon } from "@/Client/views/components/brand-icon";
import { FeedbackDialog } from "@/Client/views/components/feedback-dialog";
import { PasswordInput } from "@/Client/views/components/password-input";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message?: string; feedbackError?: string; feedbackId?: string }> }) {
  if (!(await isSetupComplete())) redirect("/setup");
  if (await getCurrentUser()) redirect("/");
  const { message, feedbackError, feedbackId } = await searchParams;
  return <main className="auth-page"><div className="auth-panel">
    {feedbackId && <FeedbackDialog message={message} isError={feedbackError === "1"} feedbackId={feedbackId} />}
    <div className="auth-brand"><BrandIcon className="brand-mark" /><span><strong>BHW Records</strong><small>Barangay health desk</small></span></div>
    <p className="eyebrow">Staff access</p><h1>Welcome back</h1>
    <p className="muted">Sign in to manage child records for your assigned barangay.</p>
    {message && !feedbackId && <p className="notice" role="status">{message}</p>}
    <form action={login} className="form-stack">
      <div className="field"><label htmlFor="username">Username</label><input id="username" name="username" autoComplete="username" required /></div>
      <div className="field"><label htmlFor="password">Password</label><PasswordInput id="password" name="password" autoComplete="current-password" required /></div>
      <button className="primary-button" type="submit">Sign in</button>
    </form>
    <p className="auth-footnote">Need an account or a password reset? Contact your administrator.</p>
  </div><div className="auth-side"><div><BrandIcon className="auth-side-icon" /><h2>Care, organized by community.</h2><p>One shared place for child records, barangay assignments, and clear monthly age reporting.</p></div></div></main>;
}
