import "server-only";
import { AppUser, db } from "./auth";

export type Barangay = { id: string; name: string };
export type Child = {
  id: string; name: string; birthday: string; sex: "F" | "M"; parents: string;
  barangay_id: string; barangay_name: string; bhw_names: string | null;
};
export type ManagedUser = AppUser & { assigned_ids: string | null };

export async function isSetupComplete(): Promise<boolean> {
  const row = await db().prepare("SELECT value FROM settings WHERE key = 'setup_complete'").first<{ value: string }>();
  return row?.value === "yes";
}

export async function listBarangays(user: AppUser): Promise<Barangay[]> {
  const sql = user.role === "admin"
    ? "SELECT id, name FROM barangays ORDER BY name COLLATE NOCASE"
    : `SELECT b.id, b.name FROM barangays b JOIN assignments a ON a.barangay_id = b.id
       WHERE a.user_id = ? ORDER BY b.name COLLATE NOCASE`;
  const statement = db().prepare(sql);
  const rows = user.role === "admin" ? await statement.all<Barangay>() : await statement.bind(user.id).all<Barangay>();
  return rows.results;
}

export async function canAccessBarangay(user: AppUser, barangayId: string): Promise<boolean> {
  if (user.role === "admin") {
    return !!(await db().prepare("SELECT id FROM barangays WHERE id = ?").bind(barangayId).first());
  }
  return !!(await db().prepare("SELECT 1 FROM assignments WHERE user_id = ? AND barangay_id = ?")
    .bind(user.id, barangayId).first());
}

export async function listChildren(user: AppUser, q = "", barangayId = ""): Promise<Child[]> {
  const search = `%${q.trim().slice(0, 80)}%`;
  const rows = await db().prepare(`SELECT c.id, c.name, c.birthday, c.sex, c.parents,
      c.barangay_id, b.name AS barangay_name,
      (SELECT group_concat(u.display_name, ', ') FROM assignments a
       JOIN users u ON u.id = a.user_id WHERE a.barangay_id = c.barangay_id) AS bhw_names
    FROM children c JOIN barangays b ON b.id = c.barangay_id
    WHERE (? = 'admin' OR EXISTS (SELECT 1 FROM assignments a WHERE a.user_id = ? AND a.barangay_id = c.barangay_id))
      AND (? = '' OR c.barangay_id = ?)
      AND (? = '%%' OR c.name LIKE ? OR c.parents LIKE ?)
    ORDER BY c.name COLLATE NOCASE, c.birthday`).bind(
      user.role, user.id, barangayId, barangayId, search, search, search,
    ).all<Child>();
  return rows.results;
}

export async function listManagedUsers(): Promise<ManagedUser[]> {
  const rows = await db().prepare(`SELECT u.*,
    (SELECT group_concat(barangay_id, ',') FROM assignments WHERE user_id = u.id) AS assigned_ids
    FROM users u WHERE u.role = 'bhw' ORDER BY u.display_name COLLATE NOCASE`).all<ManagedUser>();
  return rows.results;
}
