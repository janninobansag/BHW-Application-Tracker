import Link from "next/link";
import { ArrowUpRight, KeyRound, UserRound } from "lucide-react";
import type { AppUser } from "@/Data/entities";

export function AccountIdentity({ user }: { user: AppUser }) {
  return <div className="account-identity"><span className="account-identity-avatar" aria-hidden="true"><UserRound /></span><div><strong>{user.display_name}</strong><span>@{user.username}</span><small>{user.role === "admin" ? "Administrator" : "Health worker"}</small></div></div>;
}

export function AccountSettings({ user, onNavigate }: { user: AppUser; onNavigate?: () => void }) {
  return <div className="account-settings-body">
    <AccountIdentity user={user} />
    <section className="account-settings-section"><h3>Security</h3><p>Manage how you access your account.</p><Link href="/password" className="account-settings-action" onClick={onNavigate}><span className="account-action-icon"><KeyRound aria-hidden="true" /></span><span><strong>Change password</strong><small>Update your sign-in password</small></span><ArrowUpRight aria-hidden="true" /></Link></section>
  </div>;
}
