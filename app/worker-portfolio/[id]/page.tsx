import { notFound } from "next/navigation";
import { requireUser } from "@/Services/auth";
import { AppShell } from "@/Client/views/components/shell";
import { HouseholdEditor } from "@/Client/views/components/household-editor";
import { getHouseholdProfile, listBarangays, listPuroks, listSitios } from "@/Data/repositories";

export const dynamic = "force-dynamic";
export default async function EditHouseholdPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [profile, barangays, puroks, sitios] = await Promise.all([getHouseholdProfile(id), listBarangays(user), listPuroks(user), listSitios(user)]);
  if (!profile) notFound();
  return <AppShell user={user} title="Edit household" eyebrow="Household profiling" contentClassName="worker-portfolio-page"><HouseholdEditor user={user} barangays={barangays} puroks={puroks} sitios={sitios} existing={profile} /></AppShell>;
}
