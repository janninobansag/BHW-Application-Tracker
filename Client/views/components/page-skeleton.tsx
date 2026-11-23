import { BrandIcon } from "@/Client/views/components/brand-icon";

type LoadingView = "dashboard" | "registry" | "admin" | "activity" | "edit" | "notifications" | "simple";

function Bar({ width = "100%", className = "" }: { width?: string; className?: string }) {
  return <span className={`page-skeleton-bar ${className}`} style={{ width }} aria-hidden="true" />;
}

function SkeletonRows({ count = 5 }: { count?: number }) {
  return <div className="page-skeleton-rows" aria-hidden="true">{Array.from({ length: count }, (_, index) =>
    <div className="page-skeleton-row" key={index}>
      <div className="page-skeleton-row-primary"><Bar width={index % 2 ? "70%" : "85%"} /><Bar width="42%" className="page-skeleton-line-small" /></div>
      <Bar width="50%" className="page-skeleton-row-detail" />
      <Bar width="70%" className="page-skeleton-row-detail" />
      <Bar width="36%" className="page-skeleton-row-detail" />
    </div>)}</div>;
}

function RegistrySkeleton() {
  return <>
    <div className="page-skeleton-stats" aria-hidden="true">{[0, 1, 2].map((item) => <div key={item} className="page-skeleton-stat"><Bar width="48%" /><Bar width="24%" className="page-skeleton-stat-number" /><Bar width="62%" className="page-skeleton-line-small" /></div>)}</div>
    <div className="page-skeleton-registry-grid">
      <section className="page-skeleton-card page-skeleton-registry">
        <div className="page-skeleton-card-heading" aria-hidden="true"><div><Bar width="80px" className="page-skeleton-line-small" /><Bar width="220px" className="page-skeleton-heading-line" /></div><Bar width="170px" className="page-skeleton-button" /></div>
        <div className="page-skeleton-filters" aria-hidden="true"><Bar /><Bar /><Bar /></div>
        <SkeletonRows />
      </section>
    </div>
  </>;
}

function DashboardSkeleton() {
  return <div className="page-skeleton-dashboard">
    <div className="page-skeleton-dashboard-cards" aria-hidden="true">{[0, 1].map((item) => <div className="page-skeleton-card page-skeleton-dashboard-card" key={item}><Bar width="46%" /><Bar width="20%" className="page-skeleton-stat-number" /><div className="page-skeleton-dashboard-pair"><Bar width="40%" /><Bar width="32%" /></div><Bar width="65%" /></div>)}</div>
    <div className="page-skeleton-dashboard-details" aria-hidden="true">{[0, 1].map((item) => <div className="page-skeleton-card" key={item}><Bar width="36%" className="page-skeleton-heading-line" /><SkeletonRows count={3} /></div>)}</div>
  </div>;
}

function AdminSkeleton() {
  return <>
    <div className="page-skeleton-admin-intro page-skeleton-card" aria-hidden="true"><Bar width="90px" className="page-skeleton-line-small" /><Bar width="250px" className="page-skeleton-heading-line" /><Bar width="52%" /></div>
    <div className="page-skeleton-admin-grid">
      <section className="page-skeleton-card"><Bar width="180px" className="page-skeleton-heading-line" /><div className="page-skeleton-filters" aria-hidden="true"><Bar /><Bar /></div><SkeletonRows count={4} /></section>
      <section className="page-skeleton-card"><Bar width="190px" className="page-skeleton-heading-line" /><SkeletonRows count={3} /></section>
    </div>
  </>;
}

function ActivitySkeleton() {
  return <section className="page-skeleton-card"><Bar width="160px" className="page-skeleton-heading-line" /><div className="page-skeleton-filters" aria-hidden="true"><Bar /><Bar /><Bar /></div><SkeletonRows count={6} /></section>;
}

function EditSkeleton() {
  return <div className="page-skeleton-edit-grid">
    <section className="page-skeleton-card"><Bar width="55%" className="page-skeleton-heading-line" /><Bar width="80%" />{[0, 1, 2, 3, 4, 5].map((item) => <div className="page-skeleton-field" key={item} aria-hidden="true"><Bar width="26%" className="page-skeleton-line-small" /><Bar className="page-skeleton-input" /></div>)}</section>
    <aside className="page-skeleton-card"><Bar width="40%" className="page-skeleton-heading-line" /><SkeletonRows count={4} /></aside>
  </div>;
}

export function PageSkeleton({ title, view = "simple" }: { title: string; view?: LoadingView }) {
  return <div className="app-shell page-skeleton-shell">
    <aside className="sidebar page-skeleton-sidebar" aria-hidden="true">
      <div className="brand"><BrandIcon className="brand-mark" /><span><strong>BHW Records</strong><small>Minglanilla, Cebu</small></span></div>
      <div className="page-skeleton-side-links"><Bar width="38%" className="page-skeleton-line-small" />{[0, 1, 2, 3].map((item) => <Bar key={item} width={item % 2 ? "70%" : "84%"} className="page-skeleton-nav-line" />)}</div>
      <div className="page-skeleton-sidebar-account"><Bar width="36px" className="page-skeleton-avatar" /><Bar width="55%" /></div>
    </aside>
    <div className="main-column">
      <header className="topbar page-skeleton-topbar" aria-hidden="true"><div className="page-skeleton-mobile-brand"><BrandIcon className="brand-mark" /></div><Bar width="190px" className="page-skeleton-desktop-crumb" /><div className="page-skeleton-top-actions"><Bar width="36px" className="page-skeleton-icon" /><Bar width="36px" className="page-skeleton-icon" /><Bar width="36px" className="page-skeleton-icon" /><Bar width="36px" className="page-skeleton-icon" /></div></header>
      <main className="content page-skeleton-content" aria-busy="true">
        <div className="page-skeleton-title"><h1 id="workspace-title">{title}</h1><Bar width="120px" className="page-skeleton-title-aside" /></div>
        <p className="sr-only">Loading {title}.</p>
        {view === "dashboard" ? <DashboardSkeleton /> : view === "registry" ? <RegistrySkeleton /> : view === "admin" ? <AdminSkeleton /> : view === "activity" ? <ActivitySkeleton /> : view === "edit" ? <EditSkeleton /> : view === "notifications" ? <ActivitySkeleton /> : <div className="page-skeleton-card page-skeleton-simple"><Bar width="32%" className="page-skeleton-heading-line" /><Bar width="65%" /></div>}
      </main>
    </div>
  </div>;
}

export function AuthSkeleton({ setup = false }: { setup?: boolean }) {
  return <main className="page-skeleton-auth" aria-busy="true">
    <div className="page-skeleton-auth-panel"><div className="page-skeleton-auth-brand" aria-hidden="true"><BrandIcon className="brand-mark" /><Bar width="140px" /></div><p className="sr-only">Loading {setup ? "account setup" : "sign in"}.</p><Bar width="115px" className="page-skeleton-line-small" /><Bar width="75%" className="page-skeleton-auth-title" /><Bar width="86%" /><div className="page-skeleton-auth-fields" aria-hidden="true">{Array.from({ length: setup ? 3 : 2 }, (_, item) => <div className="page-skeleton-field" key={item}><Bar width="30%" className="page-skeleton-line-small" /><Bar className="page-skeleton-input" /></div>)}<Bar className="page-skeleton-button" /></div></div>
    <div className="page-skeleton-auth-side" aria-hidden="true"><Bar width="58%" className="page-skeleton-auth-side-line" /><Bar width="43%" /></div>
  </main>;
}

export function PasswordSkeleton() {
  return <main className="simple-page page-skeleton-password" aria-busy="true"><div className="simple-panel"><p className="sr-only">Loading password settings.</p><Bar width="120px" className="page-skeleton-line-small" /><Bar width="65%" className="page-skeleton-heading-line" />{[0, 1, 2].map((item) => <div className="page-skeleton-field" key={item} aria-hidden="true"><Bar width="35%" className="page-skeleton-line-small" /><Bar className="page-skeleton-input" /></div>)}<Bar className="page-skeleton-button" /></div></main>;
}
