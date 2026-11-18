import "server-only";
import { backendJson } from "./api-client";
import type { AppUser, Barangay, Child, ManagedUser, Purok } from "./entities";
export type { Barangay, Child, ManagedUser, Purok } from "./entities";

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

export async function listChildren(_user: AppUser, q = "", barangayId = ""): Promise<Child[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (barangayId) params.set("barangay", barangayId);
  const query = params.size ? `?${params}` : "";
  return (await backendJson<{ children: Child[] }>(`/children${query}`)).children;
}

export async function listManagedUsers(): Promise<ManagedUser[]> {
  return (await backendJson<{ users: ManagedUser[] }>("/admin/users")).users;
}
