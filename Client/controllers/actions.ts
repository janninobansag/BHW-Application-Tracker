"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { backendRequest } from "@/Data/api-client";
import { assertSameOrigin, clearLocalSession } from "@/Services/auth";

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const go = (path: string, message: string, error = false): never => redirect(`${path}${path.includes("?") ? "&" : "?"}message=${encodeURIComponent(message)}&feedbackError=${error ? "1" : "0"}&feedbackId=${randomUUID()}`);
const formObject = (form: FormData) => Object.fromEntries([...form.keys()].map((key) => [key, form.getAll(key).length > 1 ? form.getAll(key).map(String) : String(form.get(key) ?? "")]));

async function submit(path: string, form: FormData, target: string, method = "POST", body: unknown = formObject(form)) {
  await assertSameOrigin();
  let response: Response;
  try {
    response = await backendRequest(path, { method, body: JSON.stringify(body) });
  } catch {
    return go(target, "The BHW service is unavailable. Try again shortly.", true);
  }
  const result = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) go(target, result.message || "The request could not be completed.", true);
  return result.message || "Saved.";
}

export async function setupAdmin(form: FormData) {
  go("/login", await submit("/auth/setup-admin", form, "/setup"));
}

export async function login(form: FormData) {
  await assertSameOrigin();
  let response: Response;
  try {
    response = await backendRequest("/auth/login", { method: "POST", body: JSON.stringify({ username: value(form, "username"), password: String(form.get("password") ?? "") }) });
  } catch {
    return go("/login", "The BHW service is unavailable. Try again shortly.");
  }
  const result = await response.json().catch(() => ({})) as { message?: string; user?: { must_change_password: number } };
  if (!response.ok) go("/login", result.message || "Invalid username or password.");
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  if (cookie) {
    const separator = cookie.indexOf("=");
    (await cookies()).set(cookie.slice(0, separator), cookie.slice(separator + 1), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 12 * 60 * 60,
    });
  }
  redirect(result.user?.must_change_password ? "/password" : "/");
}

export async function logout() {
  await assertSameOrigin();
  try { await backendRequest("/auth/logout", { method: "POST", body: "{}" }); } catch { /* always clear the browser cookie */ }
  await clearLocalSession();
  redirect("/login");
}

export async function changeOwnPassword(form: FormData) {
  const message = await submit("/auth/password", form, "/password");
  await clearLocalSession();
  go("/login", message);
}

export async function saveChild(form: FormData) {
  const message = await submit("/children", form, "/");
  go("/", message);
}

export async function deleteChildRecord(form: FormData) {
  const id = value(form, "childId");
  const requestedReturnTo = value(form, "returnTo");
  const returnTo = requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//") && !requestedReturnTo.includes("\\") ? requestedReturnTo : "/";
  const message = await submit(`/children/${encodeURIComponent(id)}`, form, returnTo, "DELETE", { updatedAt: value(form, "updatedAt") });
  go(returnTo, message);
}

export async function saveTimbangRecord(form: FormData) {
  go("/operation-timbang", await submit("/operation-timbang", form, "/operation-timbang"));
}

export async function deleteTimbangRecord(form: FormData) {
  const id = value(form, "childId");
  const requestedReturnTo = value(form, "returnTo");
  const returnTo = requestedReturnTo.startsWith("/operation-timbang?") && !requestedReturnTo.includes("\\") ? requestedReturnTo : "/operation-timbang";
  go(returnTo, await submit(`/operation-timbang/${encodeURIComponent(id)}`, form, returnTo, "DELETE", { updatedAt: value(form, "updatedAt") }));
}

export async function addBarangay(form: FormData) {
  go("/admin", await submit("/admin/barangays", form, "/admin"));
}

export async function editBarangay(form: FormData) {
  const id = value(form, "barangayId");
  go("/admin", await submit(`/admin/barangays/${encodeURIComponent(id)}`, form, "/admin", "PUT", { name: value(form, "name") }));
}

export async function deleteBarangay(form: FormData) {
  const id = value(form, "barangayId");
  go("/admin", await submit(`/admin/barangays/${encodeURIComponent(id)}`, form, "/admin", "DELETE", {}));
}

export async function addPurok(form: FormData) {
  go("/admin", await submit("/admin/puroks", form, "/admin"));
}

export async function addSitio(form: FormData) {
  go("/admin", await submit("/admin/sitios", form, "/admin"));
}

export async function editSitio(form: FormData) {
  const id = value(form, "sitioId");
  go("/admin", await submit(`/admin/sitios/${encodeURIComponent(id)}`, form, "/admin", "PUT", { name: value(form, "name") }));
}

export async function deleteSitio(form: FormData) {
  const id = value(form, "sitioId");
  go("/admin", await submit(`/admin/sitios/${encodeURIComponent(id)}`, form, "/admin", "DELETE", {}));
}

export async function editPurok(form: FormData) {
  const id = value(form, "purokId");
  go("/admin", await submit(`/admin/puroks/${encodeURIComponent(id)}`, form, "/admin", "PUT", { name: value(form, "name") }));
}

export async function deletePurok(form: FormData) {
  const id = value(form, "purokId");
  go("/admin", await submit(`/admin/puroks/${encodeURIComponent(id)}`, form, "/admin", "DELETE", {}));
}

export async function createBhw(form: FormData) {
  go("/admin", await submit("/admin/users", form, "/admin"));
}

export async function saveAssignments(form: FormData) {
  const userId = value(form, "userId");
  const body = { barangayIds: form.getAll("barangayId").map(String), purokIds: form.getAll("purokId").map(String) };
  go("/admin", await submit(`/admin/users/${encodeURIComponent(userId)}/assignments`, form, "/admin", "PUT", body));
}

export async function resetBhwPassword(form: FormData) {
  const id = value(form, "userId");
  go("/admin", await submit(`/admin/users/${encodeURIComponent(id)}/password`, form, "/admin"));
}

export async function setBhwActive(form: FormData) {
  const id = value(form, "userId");
  go("/admin", await submit(`/admin/users/${encodeURIComponent(id)}/active`, form, "/admin", "PUT", { active: value(form, "active") === "1" }));
}
