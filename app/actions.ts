"use server";

import { redirect } from "next/navigation";
import { getChatGPTUser } from "./chatgpt-auth";
import { assertSameOrigin, cleanUsername, clearCurrentSession, createSession, db,
  getCurrentUser, hashPassword, requireAdmin, requireUser, revokeSessions,
  validPassword, verifyPassword } from "../lib/auth";
import { canAccessBarangay, isSetupComplete } from "../lib/data";
import { isValidBirthday } from "../lib/bhw";

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const go = (path: string, message: string): never => redirect(`${path}?message=${encodeURIComponent(message)}`);

export async function setupAdmin(form: FormData) {
  await assertSameOrigin();
  if (await isSetupComplete()) go("/login", "Setup is already complete.");
  if (!(await getChatGPTUser())) go("/setup", "Owner sign-in is required.");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (!validPassword(password) || password !== confirm) go("/setup", "Use a matching password of 12–128 characters.");
  const now = new Date().toISOString();
  const hash = await hashPassword(password);
  const database = db();
  await database.batch([
    database.prepare("INSERT INTO users (id, username, display_name, role, password_hash, is_active, must_change_password, created_at, updated_at) VALUES ('admin', 'admin', 'Admin', 'admin', ?, 1, 0, ?, ?)").bind(hash, now, now),
    database.prepare("INSERT INTO users (id, username, display_name, role, password_hash, is_active, must_change_password, created_at, updated_at) VALUES ('joy', 'joy', 'Joy', 'bhw', NULL, 0, 1, ?, ?)").bind(now, now),
    database.prepare("INSERT INTO users (id, username, display_name, role, password_hash, is_active, must_change_password, created_at, updated_at) VALUES ('jan', 'jan', 'Jan', 'bhw', NULL, 0, 1, ?, ?)").bind(now, now),
    database.prepare("INSERT INTO barangays (id, name, created_at) VALUES ('tulay', 'Tulay', ?)").bind(now),
    database.prepare("INSERT INTO barangays (id, name, created_at) VALUES ('tipay', 'Tipay', ?)").bind(now),
    database.prepare("INSERT INTO assignments (user_id, barangay_id) VALUES ('joy', 'tulay')"),
    database.prepare("INSERT INTO assignments (user_id, barangay_id) VALUES ('jan', 'tipay')"),
    database.prepare("INSERT INTO settings (key, value) VALUES ('setup_complete', 'yes')"),
  ]);
  go("/login", "Admin password set. Sign in as Admin.");
}

export async function login(form: FormData) {
  await assertSameOrigin();
  if (!(await isSetupComplete())) redirect("/setup");
  const username = cleanUsername(value(form, "username"));
  const password = String(form.get("password") ?? "");
  if (!username || username.length > 80 || password.length > 128) go("/login", "Invalid username or password.");
  const database = db();
  const attempt = await database.prepare("SELECT failures, locked_until FROM login_attempts WHERE username = ?")
    .bind(username).first<{ failures: number; locked_until: string | null }>();
  if (attempt?.locked_until && attempt.locked_until > new Date().toISOString()) go("/login", "Too many attempts. Try again later.");
  const user = await database.prepare("SELECT id, password_hash, is_active, must_change_password FROM users WHERE username = ?")
    .bind(username).first<{ id: string; password_hash: string | null; is_active: number; must_change_password: number }>();
  const accepted = !!user?.is_active && await verifyPassword(password, user.password_hash);
  if (!accepted) {
    const failures = (attempt?.failures ?? 0) + 1;
    const lockedUntil = failures >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null;
    await database.prepare(`INSERT INTO login_attempts (username, failures, locked_until) VALUES (?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET failures = excluded.failures, locked_until = excluded.locked_until`)
      .bind(username, failures >= 5 ? 0 : failures, lockedUntil).run();
    return go("/login", "Invalid username or password.");
  }
  if (!user) return go("/login", "Invalid username or password.");
  await database.prepare("DELETE FROM login_attempts WHERE username = ?").bind(username).run();
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
  if (!(await verifyPassword(current, user.password_hash))) go("/password", "Current password is incorrect.");
  if (!validPassword(next) || next !== confirm || next === current) go("/password", "Choose a different matching password of 12–128 characters.");
  await db().prepare("UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?")
    .bind(await hashPassword(next), new Date().toISOString(), user.id).run();
  await revokeSessions(user.id);
  await clearCurrentSession();
  go("/login", "Password updated. Sign in again.");
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
  if (!name || name.length > 120 || !parents || parents.length > 240 || !isValidBirthday(birthday) ||
      !["F", "M"].includes(sex) || !(await canAccessBarangay(user, barangayId))) {
    go("/", "Check the child details and assigned barangay.");
  }
  const now = new Date().toISOString();
  if (id) {
    const existing = await db().prepare("SELECT barangay_id FROM children WHERE id = ?").bind(id).first<{ barangay_id: string }>();
    if (!existing || !(await canAccessBarangay(user, existing.barangay_id))) go("/", "Record unavailable.");
    await db().prepare(`UPDATE children SET name = ?, birthday = ?, sex = ?, parents = ?, barangay_id = ?, updated_at = ? WHERE id = ?`)
      .bind(name, birthday, sex, parents, barangayId, now, id).run();
    go("/", "Child record updated.");
  }
  await db().prepare(`INSERT INTO children (id, name, birthday, sex, parents, barangay_id, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), name, birthday, sex, parents, barangayId, user.id, now, now).run();
  go("/", "Child record added.");
}

export async function addBarangay(form: FormData) {
  await assertSameOrigin();
  await requireAdmin();
  const name = value(form, "name");
  if (!name || name.length > 100) go("/admin", "Enter a barangay name under 100 characters.");
  const exists = await db().prepare("SELECT 1 FROM barangays WHERE lower(name) = lower(?)").bind(name).first();
  if (exists) go("/admin", "Barangay already exists.");
  await db().prepare("INSERT INTO barangays (id, name, created_at) VALUES (?, ?, ?)")
    .bind(crypto.randomUUID(), name, new Date().toISOString()).run();
  go("/admin", "Barangay added.");
}

export async function createBhw(form: FormData) {
  await assertSameOrigin();
  await requireAdmin();
  const username = cleanUsername(value(form, "username"));
  const displayName = value(form, "displayName");
  const password = String(form.get("temporaryPassword") ?? "");
  if (!/^[a-z0-9._-]{3,40}$/.test(username) || !displayName || displayName.length > 100 || !validPassword(password)) {
    go("/admin", "Use a valid username, name, and temporary password of 12–128 characters.");
  }
  if (await db().prepare("SELECT 1 FROM users WHERE username = ?").bind(username).first()) go("/admin", "Username already exists.");
  const now = new Date().toISOString();
  await db().prepare(`INSERT INTO users (id, username, display_name, role, password_hash, is_active, must_change_password, created_at, updated_at)
    VALUES (?, ?, ?, 'bhw', ?, 1, 1, ?, ?)`).bind(crypto.randomUUID(), username, displayName, await hashPassword(password), now, now).run();
  go("/admin", "BHW account created. Assign a barangay before use.");
}

export async function saveAssignments(form: FormData) {
  await assertSameOrigin();
  await requireAdmin();
  const userId = value(form, "userId");
  const user = await db().prepare("SELECT id FROM users WHERE id = ? AND role = 'bhw'").bind(userId).first();
  if (!user) return go("/admin", "BHW account unavailable.");
  const barangayIds = [...new Set(form.getAll("barangayId").map(String))];
  const checks = await Promise.all(barangayIds.map((id) => db().prepare("SELECT id FROM barangays WHERE id = ?").bind(id).first()));
  if (checks.some((row) => !row)) go("/admin", "Invalid barangay assignment.");
  await db().batch([
    db().prepare("DELETE FROM assignments WHERE user_id = ?").bind(userId),
    ...barangayIds.map((id) => db().prepare("INSERT INTO assignments (user_id, barangay_id) VALUES (?, ?)").bind(userId, id)),
  ]);
  go("/admin", "Barangay assignments saved.");
}

export async function resetBhwPassword(form: FormData) {
  await assertSameOrigin();
  await requireAdmin();
  const userId = value(form, "userId");
  const password = String(form.get("temporaryPassword") ?? "");
  if (!validPassword(password)) go("/admin", "Temporary password must be 12–128 characters.");
  const user = await db().prepare("SELECT id FROM users WHERE id = ? AND role = 'bhw'").bind(userId).first();
  if (!user) go("/admin", "BHW account unavailable.");
  await db().prepare("UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?")
    .bind(await hashPassword(password), new Date().toISOString(), userId).run();
  await revokeSessions(userId);
  go("/admin", "Temporary password set. Activate the account if needed.");
}

export async function setBhwActive(form: FormData) {
  await assertSameOrigin();
  await requireAdmin();
  const userId = value(form, "userId");
  const active = value(form, "active") === "1";
  const user = await db().prepare("SELECT password_hash FROM users WHERE id = ? AND role = 'bhw'")
    .bind(userId).first<{ password_hash: string | null }>();
  if (!user) return go("/admin", "BHW account unavailable.");
  if (active && !user.password_hash) go("/admin", "Set a temporary password before activation.");
  await db().prepare("UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?")
    .bind(active ? 1 : 0, new Date().toISOString(), userId).run();
  if (!active) await revokeSessions(userId);
  go("/admin", active ? "BHW account reactivated." : "BHW account deactivated.");
}
