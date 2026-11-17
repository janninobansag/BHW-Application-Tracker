import "server-only";
import { db, ensurePurokSchema } from "./context";
import type { AppUser, Barangay, Child, ManagedUser, Purok } from "./entities";
export type { Barangay, Child, ManagedUser, Purok } from "./entities";

export async function isSetupComplete(): Promise<boolean> {
  const row = await db().prepare("SELECT value FROM settings WHERE key = 'setup_complete'").first<{ value: string }>();
  return row?.value === "yes";
}

export async function listBarangays(user: AppUser): Promise<Barangay[]> {
  await ensurePurokSchema();
  const sql = user.role === "admin"
    ? "SELECT id, name FROM barangays ORDER BY name COLLATE NOCASE"
    : `SELECT DISTINCT b.id, b.name FROM barangays b
       JOIN puroks p ON p.barangay_id = b.id
       JOIN purok_assignments pa ON pa.purok_id = p.id
       WHERE pa.user_id = ? ORDER BY b.name COLLATE NOCASE`;
  const statement = db().prepare(sql);
  const rows = user.role === "admin" ? await statement.all<Barangay>() : await statement.bind(user.id).all<Barangay>();
  return rows.results;
}

export async function listPuroks(user: AppUser, barangayId = ""): Promise<Purok[]> {
  await ensurePurokSchema();
  const sql = user.role === "admin"
    ? `SELECT id, name, barangay_id FROM puroks WHERE (? = '' OR barangay_id = ?) ORDER BY name COLLATE NOCASE`
    : `SELECT p.id, p.name, p.barangay_id FROM puroks p JOIN purok_assignments pa ON pa.purok_id = p.id
       WHERE pa.user_id = ? AND (? = '' OR p.barangay_id = ?) ORDER BY p.name COLLATE NOCASE`;
  const statement = db().prepare(sql);
  const rows = user.role === "admin"
    ? await statement.bind(barangayId, barangayId).all<Purok>()
    : await statement.bind(user.id, barangayId, barangayId).all<Purok>();
  return rows.results;
}

export async function canAccessBarangay(user: AppUser, barangayId: string): Promise<boolean> {
  await ensurePurokSchema();
  if (user.role === "admin") {
    return !!(await db().prepare("SELECT id FROM barangays WHERE id = ?").bind(barangayId).first());
  }
  return !!(await db().prepare(`SELECT 1 FROM purok_assignments pa JOIN puroks p ON p.id = pa.purok_id
    WHERE pa.user_id = ? AND p.barangay_id = ?`).bind(user.id, barangayId).first());
}

export async function canAccessPurok(user: AppUser, purokId: string, barangayId: string): Promise<boolean> {
  await ensurePurokSchema();
  const sql = user.role === "admin"
    ? "SELECT 1 FROM puroks WHERE id = ? AND barangay_id = ?"
    : "SELECT 1 FROM purok_assignments WHERE user_id = ? AND purok_id = ? AND EXISTS (SELECT 1 FROM puroks WHERE id = ? AND barangay_id = ?)";
  const row = user.role === "admin"
    ? await db().prepare(sql).bind(purokId, barangayId).first()
    : await db().prepare(sql).bind(user.id, purokId, purokId, barangayId).first();
  return !!row;
}

export async function listChildren(user: AppUser, q = "", barangayId = ""): Promise<Child[]> {
  await ensurePurokSchema();
  const search = `%${q.trim().slice(0, 80)}%`;
  const rows = await db().prepare(`SELECT c.id, c.name, c.birthday, c.sex, c.parents,
      c.barangay_id, b.name AS barangay_name,
      c.purok_id, p.name AS purok_name,
      (SELECT group_concat(u.display_name, ', ') FROM assignments a
       JOIN users u ON u.id = a.user_id WHERE a.barangay_id = c.barangay_id) AS bhw_names
    FROM children c JOIN barangays b ON b.id = c.barangay_id LEFT JOIN puroks p ON p.id = c.purok_id
    WHERE (? = 'admin' OR EXISTS (SELECT 1 FROM purok_assignments pa WHERE pa.user_id = ? AND pa.purok_id = c.purok_id))
      AND (? = '' OR c.barangay_id = ?)
      AND (? = '%%' OR c.name LIKE ? OR c.parents LIKE ?)
    ORDER BY c.name COLLATE NOCASE, c.birthday`).bind(
      user.role, user.id, barangayId, barangayId, search, search, search,
    ).all<Child>();
  return rows.results;
}

export async function listManagedUsers(): Promise<ManagedUser[]> {
  await ensurePurokSchema();
  const rows = await db().prepare(`SELECT u.*,
    (SELECT group_concat(barangay_id, ',') FROM assignments WHERE user_id = u.id) AS assigned_ids,
    (SELECT group_concat(purok_id, ',') FROM purok_assignments WHERE user_id = u.id) AS assigned_purok_ids
    FROM users u WHERE u.role = 'bhw' ORDER BY u.display_name COLLATE NOCASE`).all<ManagedUser>();
  return rows.results;
}
