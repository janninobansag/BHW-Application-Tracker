import { redirect } from "next/navigation";
import { getCurrentUser } from "@/Services/auth";
import { changeOwnPassword } from "@/Client/controllers/actions";
import { FeedbackDialog } from "@/Client/views/components/feedback-dialog";
import { PasswordInput } from "@/Client/views/components/password-input";

export const dynamic = "force-dynamic";

export default async function PasswordPage({ searchParams }: { searchParams: Promise<{ message?: string; feedbackError?: string; feedbackId?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { message, feedbackError, feedbackId } = await searchParams;
  return <main className="simple-page"><div className="simple-panel"><p className="eyebrow">Account security</p><h1>Change your password</h1>
    <FeedbackDialog message={message} isError={feedbackError === "1"} feedbackId={feedbackId} />
    <p className="muted">{user.must_change_password ? "Your temporary password must be changed before you can view records." : "Enter your current password, then choose a new one."}</p>
    <form action={changeOwnPassword} className="form-stack">
      <div className="field"><label htmlFor="current">Current password</label><PasswordInput id="current" name="current" autoComplete="current-password" required /></div>
      <div className="field"><label htmlFor="next">New password</label><PasswordInput id="next" name="next" autoComplete="new-password" minLength={12} maxLength={128} required /></div>
      <div className="field"><label htmlFor="confirm">Confirm new password</label><PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={12} maxLength={128} required /></div>
      <button className="primary-button" type="submit">Update password</button>
    </form><a className="back-link" href="/">Back to records</a>
  </div></main>;
}
