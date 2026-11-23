import { requireUser } from "@/Services/auth";
import { AppShell } from "@/Client/views/components/shell";
import { HouseholdRegistry } from "@/Client/views/components/household-registry";
import { listBarangays, listHouseholdProfiles, listPuroks } from "@/Data/repositories";

export default async function WorkerPortfolioPage() {
  const user = await requireUser();
  const [profiles, barangays, puroks] = await Promise.all([listHouseholdProfiles(user), listBarangays(user), listPuroks(user)]);
  return <AppShell user={user} title="Household Profiling" eyebrow="Household registry" contentClassName="worker-portfolio-page">
    <HouseholdRegistry initialProfiles={profiles} barangays={barangays} puroks={puroks} user={user} />
  </AppShell>;
}
