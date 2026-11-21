import { BrandIcon } from "@/Client/views/components/brand-icon";
import type { AppUser } from "@/Data/entities";
import { OfflineSession } from "@/Client/views/components/offline-session";
import { MobileNavigation } from "@/Client/views/components/mobile-navigation";
import { ProfileMenu } from "@/Client/views/components/profile-menu";
import { AgeNotifications } from "@/Client/views/components/age-notifications";
import { PwaInstallButton } from "@/Client/views/components/pwa-install-button";
import { SidebarNavigation } from "@/Client/views/components/sidebar-navigation";
import Link from "next/link";
import { WorkerOfflineAccess } from "@/Client/views/components/worker-offline-access";

export function AppShell({ user, title, eyebrow, children, contentClassName = "", headingAside }: {
  user: AppUser; title: string; eyebrow: string; children: React.ReactNode; contentClassName?: string; headingAside?: React.ReactNode;
}) {
  const compact = ["Dashboard", "Vitamin A & Deworming", "Operation Timbang"].includes(title);
  const description = compact ? "" : title === "Administration" ? "Your people and communities, in one workspace." : title === "Notifications" ? "Review recent age updates for children in your care." : "Keep each child’s details complete and up to date.";
  return <div className="app-shell">
    <a className="skip-link" href="#workspace-title">Skip to content</a>
    <OfflineSession role={user.role} userId={user.id} />
    {user.role === "bhw" && <WorkerOfflineAccess userId={user.id} />}
    <aside className="sidebar">
      <Link href="/dashboard" className="brand" aria-label="BHW Records dashboard"><BrandIcon className="brand-mark" /><span><strong>BHW Records</strong><small>Minglanilla, Cebu</small></span></Link>
      <SidebarNavigation isAdmin={user.role === "admin"} />
      <div className="sidebar-bottom"><span className="avatar">{user.display_name.charAt(0).toUpperCase()}</span><span><strong>{user.display_name}</strong><small>{user.role === "admin" ? "Administrator" : "Health worker"}</small></span></div>
    </aside>
    <div className="main-column">
      <header className="topbar">
        <span className="desktop-header-context">Workspace <span>/</span> <strong>{title}</strong></span>
        <Link href="/dashboard" className="mobile-brand" aria-label="BHW Records dashboard"><BrandIcon className="brand-mark" /></Link>
        <div className="header-account-actions"><MobileNavigation user={user} /><div className="mobile-header-install"><PwaInstallButton /></div><AgeNotifications key={user.id} user={user} /><ProfileMenu user={user} /></div>
      </header>
      <main className={`content ${contentClassName}`}><div className={`page-heading${compact ? " compact-page-heading" : ""}`}><div>{eyebrow && !compact && <p className="eyebrow">{eyebrow}</p>}<h1 id="workspace-title" tabIndex={-1}>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{headingAside !== undefined ? <div className="page-heading-aside">{headingAside}</div> : compact ? (user.role === "bhw" && title !== "Dashboard" ? <div id="record-status-slot" /> : null) : <span className="signed-in"><span>{user.role === "admin" ? "Administrator" : "Health worker"}</span><strong>{user.display_name}</strong></span>}</div>{children}</main>
    </div>
  </div>;
}
