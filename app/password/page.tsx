import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { changeOwnPassword } from "../actions";

export const dynamic = "force-dynamic";

export default async function PasswordPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { message } = await searchParams;
  return <main className="simple-page"><div className="simple-panel"><p className="eyebrow">Account security</p><h1>Change your password</h1>
    <p className="muted">{user.must_change_password ? "Your temporary password must be changed before you can view records." : "Enter your current password, then choose a new one."}</p>
    {message && <p className="notice" role="status">{message}</p>}
    <form action={changeOwnPassword} className="form-stack">
      <div className="field"><label htmlFor="current">Current password</label><input id="current" name="current" type="password" autoComplete="current-password" required /></div>
      <div className="field"><label htmlFor="next">New password</label><input id="next" name="next" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></div>
      <div className="field"><label htmlFor="confirm">Confirm new password</label><input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></div>
      <button className="primary-button" type="submit">Update password</button>
    </form><a className="back-link" href="/">Back to records</a>
  </div></main>;
}
