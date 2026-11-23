import "server-only";
import { backendJson, backendRequest } from "./api-client";
import type { AppUser, Barangay, Child, HouseholdProfile, ManagedUser, Purok, Sitio, TimbangRecord, WorkerRecords } from "./entities";
export type { Barangay, Child, ManagedUser, Purok, Sitio } from "./entities";

export async function isSetupComplete(): Promise<boolean> {
  return (await backendJson<{ complete: boolean }>("/auth/setup-status")).complete;
}

export async function listBarangays(_user?: AppUser): Promise<Barangay[]> {
  return (await backendJson<{ barangays: Barangay[] }>("/barangays")).barangays;
}

export async function listPuroks(_user?: AppUser, barangayId = ""): Promise<Purok[]> {
  const query = barangayId ? `?barangay=${encodeURIComponent(barangayId)}` : "";
  return (await backendJson<{ puroks: Purok[] }>(`/puroks${query}`)).puroks;
}

export async function listSitios(_user?: AppUser, barangayId = ""): Promise<Sitio[]> {
  const query = barangayId ? `?barangay=${encodeURIComponent(barangayId)}` : "";
  return (await backendJson<{ sitios: Sitio[] }>(`/sitios${query}`)).sitios;
}

export async function listChildren(_user: AppUser, q = "", barangayId = "", purokId = ""): Promise<Child[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (barangayId) params.set("barangay", barangayId);
  if (purokId) params.set("purok", purokId);
  const query = params.size ? `?${params}` : "";
  return (await backendJson<{ children: Child[] }>(`/children${query}`)).children;
}

export async function listManagedUsers(): Promise<ManagedUser[]> {
  return (await backendJson<{ users: ManagedUser[] }>("/admin/users")).users;
}

export async function getWorkerRecords(id: string, program: "all" | "deworming" | "timbang", page: number): Promise<WorkerRecords | null> {
  const params = new URLSearchParams({ program, page: String(page) });
  const response = await backendRequest(`/admin/users/${encodeURIComponent(id)}/records?${params}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Render API request failed (${response.status})`);
  return await response.json() as WorkerRecords;
}

export async function listTimbangRecords(_user: AppUser): Promise<TimbangRecord[]> {
  return (await backendJson<{ children: TimbangRecord[] }>("/operation-timbang")).children;
}

export async function listHouseholdProfiles(_user: AppUser): Promise<HouseholdProfile[]> {
  return (await backendJson<{ households: HouseholdProfile[] }>("/households")).households;
}

export async function getHouseholdProfile(id: string): Promise<HouseholdProfile | null> {
  const response = await backendRequest(`/households/${encodeURIComponent(id)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Render API request failed (${response.status})`);
  return (await response.json() as { household: HouseholdProfile }).household;
}
