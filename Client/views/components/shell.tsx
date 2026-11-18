import { BrandIcon } from "@/Client/views/components/brand-icon";
import type { AppUser } from "@/Data/entities";
import { OfflineSession } from "@/Client/views/components/offline-session";
import { MobileNavigation } from "@/Client/views/components/mobile-navigation";
import { ProfileMenu } from "@/Client/views/components/profile-menu";
import { AgeNotifications } from "@/Client/views/components/age-notifications";
import { PwaInstallButton } from "@/Client/views/components/pwa-install-button";
import { SidebarNavigation } from "@/Client/views/components/sidebar-navigation";

export function AppShell({ user, title, eyebrow, children, contentClassName = "" }: {
  user: AppUser; title: string; eyebrow: string; children: React.ReactNode; contentClassName?: string;
}) {
  return <div className="app-shell">
    <OfflineSession role={user.role} />
    <aside className="sidebar">
      <div className="brand"><BrandIcon className="brand-mark" /><span><strong>BHW Records</strong><small>Barangay health desk</small></span></div>
      <SidebarNavigation isAdmin={user.role === "admin"} />
      <div className="sidebar-bottom"><span className="avatar">{user.display_name.charAt(0).toUpperCase()}</span><span><strong>{user.display_name}</strong><small>{user.role === "admin" ? "Administrator" : "Health worker"}</small></span></div>
    </aside>
    <div className="main-column">
      <header className="topbar">
        <span className="desktop-header-context">Workspace <span>/</span> <strong>{title}</strong></span>
        <div className="mobile-brand"><BrandIcon className="brand-mark" /></div>
        <div className="header-account-actions"><MobileNavigation user={user} /><div className="mobile-header-install"><PwaInstallButton /></div><AgeNotifications key={user.id} user={user} /><ProfileMenu user={user} /></div>
      </header>
      <main className={`content ${contentClassName}`}><div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div><span className="signed-in">Signed in as {user.display_name}</span></div>{children}</main>
    </div>
  </div>;
}
