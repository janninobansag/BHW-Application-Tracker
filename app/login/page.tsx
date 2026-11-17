import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { isSetupComplete } from "../../lib/data";
import { login } from "../actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  if (!(await isSetupComplete())) redirect("/setup");
  if (await getCurrentUser()) redirect("/");
  const { message } = await searchParams;
  return <main className="auth-page"><div className="auth-panel">
    <div className="auth-brand"><span className="brand-mark">✚</span><span><strong>BHW Records</strong><small>Barangay health desk</small></span></div>
    <p className="eyebrow">Staff access</p><h1>Welcome back</h1>
    <p className="muted">Sign in to manage child records for your assigned barangay.</p>
    {message && <p className="notice" role="status">{message}</p>}
    <form action={login} className="form-stack">
      <div className="field"><label htmlFor="username">Username</label><input id="username" name="username" autoComplete="username" required /></div>
      <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
      <button className="primary-button" type="submit">Sign in</button>
    </form>
    <p className="auth-footnote">Need an account or a password reset? Contact your administrator.</p>
  </div><div className="auth-side"><div><span className="auth-side-icon">✚</span><h2>Care, organized by community.</h2><p>One shared place for child records, barangay assignments, and clear monthly age reporting.</p></div></div></main>;
}
