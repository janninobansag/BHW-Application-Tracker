import { requireUser } from "@/Services/auth";
import { AppShell } from "@/Client/views/components/shell";
import { HouseholdSummary } from "@/Client/views/components/household-summary";
import { listBarangays, listHouseholdProfiles, listPuroks, listSitios } from "@/Data/repositories";

export const dynamic = "force-dynamic";

export default async function HouseholdSummaryPage() {
  const user = await requireUser();
  const [profiles, barangays, puroks, sitios] = await Promise.all([listHouseholdProfiles(user), listBarangays(user), listPuroks(user), listSitios(user)]);
  return <AppShell user={user} title="Household summary" eyebrow="Household Profiling" contentClassName="worker-portfolio-page household-summary-page">
    <HouseholdSummary profiles={profiles} barangays={barangays} puroks={puroks} sitios={sitios} workerName={user.role === "bhw" ? user.display_name : "All workers"} />
  </AppShell>;
}
