import Link from "next/link";
import type { AppUser } from "@/Data/entities";
import { logout } from "@/Client/controllers/actions";
import { PwaInstallButton } from "@/Client/views/components/pwa-install-button";

export function AppShell({ user, title, eyebrow, children }: {
  user: AppUser; title: string; eyebrow: string; children: React.ReactNode;
}) {
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">✚</span><span><strong>BHW Records</strong><small>Barangay health desk</small></span></div>
      <nav aria-label="Main navigation" className="side-nav">
        <Link href="/">Child records</Link>
        {user.role === "admin" && <Link href="/admin">Administration</Link>}
      </nav>
      <div className="sidebar-bottom"><span className="avatar">{user.display_name.charAt(0).toUpperCase()}</span><span><strong>{user.display_name}</strong><small>{user.role === "admin" ? "Administrator" : "Health worker"}</small></span></div>
    </aside>
    <div className="main-column">
      <header className="topbar">
        <div className="mobile-brand"><span className="brand-mark">✚</span><strong>BHW Records</strong></div>
        <nav className="mobile-nav" aria-label="Mobile navigation"><Link href="/">Records</Link>{user.role === "admin" && <Link href="/admin">Admin</Link>}</nav>
        <div className="top-actions"><PwaInstallButton /><Link href="/password">Change password</Link><form action={logout}><button type="submit" className="text-button">Sign out</button></form></div>
      </header>
      <main className="content"><div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div><span className="signed-in">Signed in as {user.display_name}</span></div>{children}</main>
    </div>
  </div>;
}
