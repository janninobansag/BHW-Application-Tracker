"use server";

import { redirect } from "next/navigation";
import { getChatGPTUser } from "@/Client/auth/chatgpt";
import { assertSameOrigin, cleanUsername, clearCurrentSession, createSession,
  getCurrentUser, hashPassword, requireAdmin, requireUser, revokeSessions,
  validPassword, verifyPassword } from "@/Services/auth";
import { canAccessBarangay, canAccessPurok, isSetupComplete, listPuroks } from "@/Data/repositories";
import { validChildDetails } from "@/Services/child-records";
import { validBarangayName, validBhwAccount } from "@/Services/staff";
import { messages } from "@/Resources/copy";
import { barangayExists, barangayNameExists, barangayNameExistsElsewhere, clearLoginAttempts, findBhw, findChildBarangay,
  findLoginAttempt, findLoginUser, initializeAdmin, insertBarangay, insertBhw, insertChild,
  insertPurok, purokNameExists, purokNameExistsElsewhere, recordLoginFailure, replaceAssignments, resetBhwPassword as writeBhwPassword,
  setBhwActive as writeBhwActive, updateBarangay, updateChild, updateOwnPassword, updatePurok,
  usernameExists } from "@/Data/commands";

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const go = (path: string, message: string): never => redirect(`${path}?message=${encodeURIComponent(message)}`);

export async function setupAdmin(form: FormData) {
  await assertSameOrigin();
  if (await isSetupComplete()) go("/login", messages.setupComplete);
  if (!(await getChatGPTUser())) go("/setup", messages.ownerRequired);
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (!validPassword(password) || password !== confirm) go("/setup", messages.passwordMismatch);
  const now = new Date().toISOString();
  const hash = await hashPassword(password);
  await initializeAdmin(hash, now);
  go("/login", messages.adminReady);
}

export async function login(form: FormData) {
  await assertSameOrigin();
  if (!(await isSetupComplete())) redirect("/setup");
  const username = cleanUsername(value(form, "username"));
  const password = String(form.get("password") ?? "");
  if (!username || username.length > 80 || password.length > 128) go("/login", messages.badLogin);
  const attempt = await findLoginAttempt(username);
  if (attempt?.locked_until && attempt.locked_until > new Date().toISOString()) go("/login", messages.loginLocked);
  const user = await findLoginUser(username);
  const accepted = !!user?.is_active && await verifyPassword(password, user.password_hash);
  if (!accepted) {
    const failures = (attempt?.failures ?? 0) + 1;
    const lockedUntil = failures >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null;
    await recordLoginFailure(username, failures >= 5 ? 0 : failures, lockedUntil);
    return go("/login", messages.badLogin);
  }
  if (!user) return go("/login", messages.badLogin);
  await clearLoginAttempts(username);
  await createSession(user.id);
  redirect(user.must_change_password ? "/password" : "/");
}

export async function logout() {
  await assertSameOrigin();
  await clearCurrentSession();
  redirect("/login");
}

export async function changeOwnPassword(form: FormData) {
  await assertSameOrigin();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (!(await verifyPassword(current, user.password_hash))) go("/password", messages.currentPasswordWrong);
  if (!validPassword(next) || next !== confirm || next === current) go("/password", messages.newPasswordInvalid);
  await updateOwnPassword(user.id, await hashPassword(next), new Date().toISOString());
  await revokeSessions(user.id);
  await clearCurrentSession();
  go("/login", messages.passwordUpdated);
}

export async function saveChild(form: FormData) {
  await assertSameOrigin();
  const user = await requireUser();
  const id = value(form, "id");
  const name = value(form, "name");
  const birthday = value(form, "birthday");
  const sex = value(form, "sex");
  const parents = value(form, "parents");
  const barangayId = value(form, "barangayId");
  const purokId = value(form, "purokId");
  if (!validChildDetails({ name, birthday, sex, parents }) || !(await canAccessBarangay(user, barangayId)) ||
      !(await canAccessPurok(user, purokId, barangayId))) {
    go("/", messages.childInvalid);
  }
  const now = new Date().toISOString();
  if (id) {
    const existingBarangay = await findChildBarangay(id);
    if (!existingBarangay || !(await canAccessBarangay(user, existingBarangay))) go("/", messages.childMissing);
    await updateChild({ id, name, birthday, sex, parents, barangayId, purokId, userId: user.id, now });
    go("/", messages.childUpdated);
  }
  await insertChild({ id: crypto.randomUUID(), name, birthday, sex, parents, barangayId, purokId, userId: user.id, now });
  go("/", messages.childAdded);
}

export async function addBarangay(form: FormData) {
  await assertSameOrigin();
  await requireAdmin();
  const name = value(form, "name");
  if (!validBarangayName(name)) go("/admin", messages.barangayInvalid);
  if (await barangayNameExists(name)) go("/admin", messages.barangayExists);
  await insertBarangay(crypto.randomUUID(), name, new Date().toISOString());
  go("/admin", messages.barangayAdded);
}

export async function editBarangay(form: FormData) {
  await assertSameOrigin();
  await requireAdmin();
  const id = value(form, "barangayId");
  const name = value(form, "name");
  if (!validBarangayName(name)) go("/admin", messages.barangayInvalid);
  if (await barangayNameExistsElsewhere(id, name)) go("/admin", messages.barangayExists);
  await updateBarangay(id, name);
  go("/admin", messages.barangayUpdated);
}

export async function addPurok(form: FormData) {
  await assertSameOrigin();
  const admin = await requireAdmin();
  const barangayId = value(form, "barangayId");
  const name = value(form, "name");
  if (!(await canAccessBarangay(admin, barangayId)) || !validBarangayName(name)) go("/admin", messages.purokInvalid);
  if (await purokNameExists(barangayId, name)) go("/admin", messages.purokExists);
  await insertPurok(crypto.randomUUID(), barangayId, name, new Date().toISOString());
  go("/admin", messages.purokAdded);
}

export async function editPurok(form: FormData) {
  await assertSameOrigin();
  await requireAdmin();
  const id = value(form, "purokId");
  const name = value(form, "name");
  if (!validBarangayName(name)) go("/admin", messages.purokInvalid);
  if (await purokNameExistsElsewhere(id, name)) go("/admin", messages.purokExists);
  await updatePurok(id, name);
  go("/admin", messages.purokUpdated);
}

export async function createBhw(form: FormData) {
  await assertSameOrigin();
  await requireAdmin();
  const username = cleanUsername(value(form, "username"));
  const displayName = value(form, "displayName");
  const password = String(form.get("temporaryPassword") ?? "");
  if (!validBhwAccount(username, displayName, password)) {
    go("/admin", messages.bhwInvalid);
  }
  if (await usernameExists(username)) go("/admin", messages.usernameExists);
  const now = new Date().toISOString();
  await insertBhw(crypto.randomUUID(), username, displayName, await hashPassword(password), now);
  go("/admin", messages.bhwCreated);
}

export async function saveAssignments(form: FormData) {
  await assertSameOrigin();
  const admin = await requireAdmin();
  const userId = value(form, "userId");
  const user = await findBhw(userId);
  if (!user) return go("/admin", messages.bhwMissing);
  const barangayIds = [...new Set(form.getAll("barangayId").map(String))];
  const purokIds = [...new Set(form.getAll("purokId").map(String))];
  const checks = await Promise.all(barangayIds.map(barangayExists));
  if (checks.some((exists) => !exists)) go("/admin", messages.assignmentInvalid);
  const puroks = await listPuroks(admin);
  const validPuroks = new Set(puroks.filter((purok) => barangayIds.includes(purok.barangay_id)).map((purok) => purok.id));
  if (purokIds.some((purokId) => !validPuroks.has(purokId))) go("/admin", messages.assignmentInvalid);
  await replaceAssignments(userId, barangayIds, purokIds);
  go("/admin", messages.assignmentSaved);
}

export async function resetBhwPassword(form: FormData) {
  await assertSameOrigin();
  await requireAdmin();
  const userId = value(form, "userId");
  const password = String(form.get("temporaryPassword") ?? "");
  if (!validPassword(password)) go("/admin", messages.tempPasswordInvalid);
  const user = await findBhw(userId);
  if (!user) go("/admin", messages.bhwMissing);
  await writeBhwPassword(userId, await hashPassword(password), new Date().toISOString());
  await revokeSessions(userId);
  go("/admin", messages.tempPasswordSet);
}

export async function setBhwActive(form: FormData) {
  await assertSameOrigin();
  await requireAdmin();
  const userId = value(form, "userId");
  const active = value(form, "active") === "1";
  const user = await findBhw(userId);
  if (!user) return go("/admin", messages.bhwMissing);
  if (active && !user.password_hash) go("/admin", messages.activateNeedsPassword);
  await writeBhwActive(userId, active, new Date().toISOString());
  if (!active) await revokeSessions(userId);
  go("/admin", active ? messages.bhwReactivated : messages.bhwDeactivated);
}
