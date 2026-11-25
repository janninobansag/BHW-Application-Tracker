import { requireUser } from "@/Services/auth";
import { AppShell } from "@/Client/views/components/shell";
import { HouseholdEditor } from "@/Client/views/components/household-editor";
import { listBarangays, listPuroks, listSitios } from "@/Data/repositories";

export const dynamic = "force-dynamic";
export default async function NewHouseholdPage() {
  const user = await requireUser();
  const [barangays, puroks, sitios] = await Promise.all([listBarangays(user), listPuroks(user), listSitios(user)]);
  return <AppShell user={user} title="Add household" eyebrow="Household profiling" contentClassName="worker-portfolio-page"><HouseholdEditor user={user} barangays={barangays} puroks={puroks} sitios={sitios} /></AppShell>;
}
