import { redirect } from "next/navigation";
import { getChatGPTUser, chatGPTSignInPath } from "@/Client/auth/chatgpt";
import { isSetupComplete } from "@/Data/repositories";
import { setupAdmin } from "@/Client/controllers/actions";

export const dynamic = "force-dynamic";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  if (await isSetupComplete()) redirect("/login");
  const owner = await getChatGPTUser();
  const { message } = await searchParams;
  return <main className="auth-page setup-page"><div className="auth-panel">
    <div className="auth-brand"><span className="brand-mark">✚</span><span><strong>BHW Records</strong><small>Barangay health desk</small></span></div>
    <p className="eyebrow">One-time owner setup</p><h1>Set the Admin password</h1>
    <p className="muted">The Admin account has no default password. Choose one now to activate it and prepare the sample barangay assignments.</p>
    {message && <p className="notice" role="status">{message}</p>}
    {owner ? <form action={setupAdmin} className="form-stack">
      <div className="field"><label htmlFor="password">Admin password</label><input id="password" name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /><small className="field-hint">Use 12–128 characters.</small></div>
      <div className="field"><label htmlFor="confirm">Confirm password</label><input id="confirm" name="confirm" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></div>
      <button className="primary-button" type="submit">Activate Admin account</button>
    </form> : <a className="primary-button" href={chatGPTSignInPath("/setup")} target="_top">Continue as site owner</a>}
    <p className="auth-footnote">Keep the site owner-only until this step is complete.</p>
  </div><div className="auth-side"><div><span className="auth-side-icon">✚</span><h2>Your health desk starts here.</h2><p>After setup, sign in as Admin to manage workers and their assigned barangays.</p></div></div></main>;
}
