import { redirect } from "next/navigation";
import { getCurrentUser } from "@/Services/auth";
import { isSetupComplete } from "@/Data/repositories";
import { login } from "@/Client/controllers/actions";
import { BrandIcon } from "@/Client/views/components/brand-icon";
import { FeedbackDialog } from "@/Client/views/components/feedback-dialog";
import { PasswordInput } from "@/Client/views/components/password-input";
import { OfflineSession } from "@/Client/views/components/offline-session";
import { LoginGallery } from "@/Client/views/components/login-gallery";
import { postLoginRoute } from "@/Services/post-login-route";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message?: string; feedbackError?: string; feedbackId?: string }> }) {
  if (!(await isSetupComplete())) redirect("/setup");
  const user = await getCurrentUser();
  if (user) redirect(postLoginRoute(user));
  const { message, feedbackError, feedbackId } = await searchParams;
  return <main className="auth-page login-page"><div className="auth-panel">
    <OfflineSession role="signed-out" />
    {feedbackId && <FeedbackDialog message={message} isError={feedbackError === "1"} feedbackId={feedbackId} />}
    <div className="auth-brand"><BrandIcon className="brand-mark" /><span><strong>BHW Records</strong><small>Minglanilla, Cebu</small></span></div>
    <p className="eyebrow">Barangay health registry</p><h1>Your community.<br />Your workspace.</h1>
    <p className="muted">Sign in to care for your community’s child health records.</p>
    {message && !feedbackId && <p className="notice" role="status">{message}</p>}
    <form action={login} className="form-stack">
      <div className="field"><label htmlFor="username">Username</label><input id="username" name="username" autoComplete="username" required /></div>
      <div className="field"><label htmlFor="password">Password</label><PasswordInput id="password" name="password" autoComplete="current-password" required /></div>
      <button className="primary-button" type="submit">Sign in</button>
    </form>
    <p className="auth-footnote">Need an account or a password reset? Contact your administrator.</p>
    <div className="auth-locality"><span>Minglanilla, Cebu</span><span>For authorized health staff</span></div>
  </div><LoginGallery /></main>;
}
