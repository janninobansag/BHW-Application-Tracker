import { requireUser } from "@/Services/auth";
import { todayInManila } from "@/Services/child-records";
import { listBarangays, listChildren, listManagedUsers, listPuroks, listSitios, listTimbangRecords } from "@/Data/repositories";
import { AppShell } from "@/Client/views/components/shell";
import { WorkerDashboard, DashboardUnavailable } from "@/Client/views/components/worker-dashboard";
import { AdminDashboard } from "@/Client/views/components/admin-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard | BHW Records" };

export default async function DashboardPage() {
  const user = await requireUser();
  const today = todayInManila();
  const dateLabel = new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }).format(new Date(`${today}T12:00:00Z`));
  const headingAside = <time dateTime={today}>{dateLabel}</time>;
  if (user.role === "admin") {
    const results = await Promise.allSettled([listChildren(user), listTimbangRecords(user), listBarangays(user), listPuroks(user), listSitios(user), listManagedUsers()] as const);
    return <AppShell user={user} title="Dashboard" eyebrow="" contentClassName="dashboard-content" headingAside={headingAside}>
      {results[0].status === "fulfilled" && results[1].status === "fulfilled" && results[2].status === "fulfilled" && results[3].status === "fulfilled" && results[4].status === "fulfilled" && results[5].status === "fulfilled"
        ? <AdminDashboard childRecords={results[0].value} timbang={results[1].value} barangays={results[2].value} puroks={results[3].value} sitios={results[4].value} users={results[5].value} />
        : <DashboardUnavailable />}
    </AppShell>;
  }
  const result = await Promise.allSettled([listChildren(user), listTimbangRecords(user), listBarangays(user), listPuroks(user)] as const);
  return <AppShell user={user} title="Dashboard" eyebrow="" contentClassName="dashboard-content" headingAside={headingAside}>
    {result[0].status === "fulfilled" && result[1].status === "fulfilled" && result[2].status === "fulfilled" && result[3].status === "fulfilled"
      ? <WorkerDashboard childrenRecords={result[0].value} timbangRecords={result[1].value} barangays={result[2].value} puroks={result[3].value} today={today} />
      : <DashboardUnavailable />}
  </AppShell>;
}
