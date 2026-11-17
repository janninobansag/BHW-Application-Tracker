import "server-only";
import { db, ensurePurokSchema } from "./context";
import type { AppUser } from "./entities";

export type LoginAttempt = { failures: number; locked_until: string | null };
export type LoginUser = { id: string; password_hash: string | null; is_active: number; must_change_password: number };

export async function initializeAdmin(passwordHash: string, now: string): Promise<void> {
  const database = db();
  await database.batch([
    database.prepare("INSERT INTO users (id, username, display_name, role, password_hash, is_active, must_change_password, created_at, updated_at) VALUES ('admin', 'admin', 'Admin', 'admin', ?, 1, 0, ?, ?)").bind(passwordHash, now, now),
    database.prepare("INSERT INTO users (id, username, display_name, role, password_hash, is_active, must_change_password, created_at, updated_at) VALUES ('joy', 'joy', 'Joy', 'bhw', NULL, 0, 1, ?, ?)").bind(now, now),
    database.prepare("INSERT INTO users (id, username, display_name, role, password_hash, is_active, must_change_password, created_at, updated_at) VALUES ('jan', 'jan', 'Jan', 'bhw', NULL, 0, 1, ?, ?)").bind(now, now),
    database.prepare("INSERT INTO barangays (id, name, created_at) VALUES ('tulay', 'Tulay', ?)").bind(now),
    database.prepare("INSERT INTO barangays (id, name, created_at) VALUES ('tipay', 'Tipay', ?)").bind(now),
    database.prepare("INSERT INTO assignments (user_id, barangay_id) VALUES ('joy', 'tulay')"),
    database.prepare("INSERT INTO assignments (user_id, barangay_id) VALUES ('jan', 'tipay')"),
    database.prepare("INSERT INTO settings (key, value) VALUES ('setup_complete', 'yes')"),
  ]);
}

export async function findLoginAttempt(username: string): Promise<LoginAttempt | null> {
  return await db().prepare("SELECT failures, locked_until FROM login_attempts WHERE username = ?")
    .bind(username).first<LoginAttempt>();
}

export async function findLoginUser(username: string): Promise<LoginUser | null> {
  return await db().prepare("SELECT id, password_hash, is_active, must_change_password FROM users WHERE username = ?")
    .bind(username).first<LoginUser>();
}

export async function recordLoginFailure(username: string, failures: number, lockedUntil: string | null): Promise<void> {
  await db().prepare(`INSERT INTO login_attempts (username, failures, locked_until) VALUES (?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET failures = excluded.failures, locked_until = excluded.locked_until`)
    .bind(username, failures, lockedUntil).run();
}

export async function clearLoginAttempts(username: string): Promise<void> {
  await db().prepare("DELETE FROM login_attempts WHERE username = ?").bind(username).run();
}

export async function updateOwnPassword(userId: string, hash: string, now: string): Promise<void> {
  await db().prepare("UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?")
    .bind(hash, now, userId).run();
}

export async function findChildBarangay(id: string): Promise<string | null> {
  const row = await db().prepare("SELECT barangay_id FROM children WHERE id = ?")
    .bind(id).first<{ barangay_id: string }>();
  return row?.barangay_id ?? null;
}

export type ChildWrite = {
  id: string; name: string; birthday: string; sex: string; parents: string;
  barangayId: string; purokId: string; userId: string; now: string;
};

export async function updateChild(input: ChildWrite): Promise<void> {
  await ensurePurokSchema();
  await db().prepare("UPDATE children SET name = ?, birthday = ?, sex = ?, parents = ?, barangay_id = ?, purok_id = ?, updated_at = ? WHERE id = ?")
    .bind(input.name, input.birthday, input.sex, input.parents, input.barangayId, input.purokId, input.now, input.id).run();
}

export async function insertChild(input: ChildWrite): Promise<void> {
  await ensurePurokSchema();
  await db().prepare(`INSERT INTO children (id, name, birthday, sex, parents, barangay_id, purok_id, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(input.id, input.name, input.birthday, input.sex, input.parents, input.barangayId, input.purokId, input.userId, input.now, input.now).run();
}

export async function barangayNameExists(name: string): Promise<boolean> {
  return !!(await db().prepare("SELECT 1 FROM barangays WHERE lower(name) = lower(?)").bind(name).first());
}

export async function barangayNameExistsElsewhere(id: string, name: string): Promise<boolean> {
  return !!(await db().prepare("SELECT 1 FROM barangays WHERE lower(name) = lower(?) AND id <> ?").bind(name, id).first());
}

export async function insertBarangay(id: string, name: string, now: string): Promise<void> {
  await db().prepare("INSERT INTO barangays (id, name, created_at) VALUES (?, ?, ?)").bind(id, name, now).run();
}

export async function updateBarangay(id: string, name: string): Promise<void> {
  await db().prepare("UPDATE barangays SET name = ? WHERE id = ?").bind(name, id).run();
}

export async function purokNameExists(barangayId: string, name: string): Promise<boolean> {
  return !!(await db().prepare("SELECT 1 FROM puroks WHERE barangay_id = ? AND lower(name) = lower(?)").bind(barangayId, name).first());
}

export async function purokNameExistsElsewhere(id: string, name: string): Promise<boolean> {
  const row = await db().prepare("SELECT barangay_id FROM puroks WHERE id = ?").bind(id).first<{ barangay_id: string }>();
  if (!row) return true;
  return !!(await db().prepare("SELECT 1 FROM puroks WHERE barangay_id = ? AND lower(name) = lower(?) AND id <> ?")
    .bind(row.barangay_id, name, id).first());
}

export async function insertPurok(id: string, barangayId: string, name: string, now: string): Promise<void> {
  await ensurePurokSchema();
  await db().prepare("INSERT INTO puroks (id, barangay_id, name, created_at) VALUES (?, ?, ?, ?)").bind(id, barangayId, name, now).run();
}

export async function updatePurok(id: string, name: string): Promise<void> {
  await ensurePurokSchema();
  await db().prepare("UPDATE puroks SET name = ? WHERE id = ?").bind(name, id).run();
}

export async function usernameExists(username: string): Promise<boolean> {
  return !!(await db().prepare("SELECT 1 FROM users WHERE username = ?").bind(username).first());
}

export async function insertBhw(id: string, username: string, displayName: string, hash: string, now: string): Promise<void> {
  await db().prepare(`INSERT INTO users (id, username, display_name, role, password_hash, is_active, must_change_password, created_at, updated_at)
    VALUES (?, ?, ?, 'bhw', ?, 1, 1, ?, ?)`).bind(id, username, displayName, hash, now, now).run();
}

export async function findBhw(userId: string): Promise<{ id: string; password_hash: string | null } | null> {
  return await db().prepare("SELECT id, password_hash FROM users WHERE id = ? AND role = 'bhw'")
    .bind(userId).first<{ id: string; password_hash: string | null }>();
}

export async function barangayExists(id: string): Promise<boolean> {
  return !!(await db().prepare("SELECT id FROM barangays WHERE id = ?").bind(id).first());
}

export async function replaceAssignments(userId: string, barangayIds: string[], purokIds: string[]): Promise<void> {
  await ensurePurokSchema();
  await db().batch([
    db().prepare("DELETE FROM assignments WHERE user_id = ?").bind(userId),
    db().prepare("DELETE FROM purok_assignments WHERE user_id = ?").bind(userId),
    ...barangayIds.map((id) => db().prepare("INSERT INTO assignments (user_id, barangay_id) VALUES (?, ?)").bind(userId, id)),
    ...purokIds.map((id) => db().prepare("INSERT INTO purok_assignments (user_id, purok_id) VALUES (?, ?)").bind(userId, id)),
  ]);
}

export async function resetBhwPassword(userId: string, hash: string, now: string): Promise<void> {
  await db().prepare("UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?")
    .bind(hash, now, userId).run();
}

export async function setBhwActive(userId: string, active: boolean, now: string): Promise<void> {
  await db().prepare("UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?")
    .bind(active ? 1 : 0, now, userId).run();
}

export async function findSessionUser(tokenHash: string, now: string): Promise<AppUser | null> {
  return await db().prepare(`SELECT u.id, u.username, u.display_name, u.role, u.password_hash,
    u.is_active, u.must_change_password FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.is_active = 1`)
    .bind(tokenHash, now).first<AppUser>();
}

export async function insertSession(tokenHash: string, userId: string, expiresAt: string): Promise<void> {
  await db().prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(tokenHash, userId, expiresAt).run();
}

export async function deleteUserSessions(userId: string): Promise<void> {
  await db().prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
}

export async function deleteSession(tokenHash: string): Promise<void> {
  await db().prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}
