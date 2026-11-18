import express, { type NextFunction, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";
import { cleanUsername, cookieValue, createSessionToken, hashPassword, hashSessionToken, sessionCookieName, validPassword, verifyPassword } from "./security.js";
import { makeWorkbook } from "./workbook.js";

type User = { id: string; username: string; display_name: string; role: "admin" | "bhw"; password_hash?: string | null; is_active: number; must_change_password: number; created_at?: string; updated_at?: string };
type UserPublic = Omit<User, "password_hash">;
type Barangay = { id: string; name: string; created_at?: string };
type Purok = { id: string; name: string; barangay_id: string; created_at?: string };
type Child = { id: string; name: string; birthday: string; sex: "F" | "M"; parents: string; barangay_id: string; purok_id: string; created_by: string; created_at: string; updated_at: string };
const now = () => new Date().toISOString();
const publicUser = (user: User): UserPublic => {
  const { password_hash: _passwordHash, ...result } = user;
  return result;
};
const message = (res: Response, status: number, text: string) => res.status(status).json({ message: text });

function validName(value: unknown, max = 100): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
}

function stringIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))];
}

function validBirthday(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day && value <= new Date().toISOString().slice(0, 10);
}

function todayInManila(): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function ageInMonths(birthday: string, today: string): number {
  const [by, bm, bd] = birthday.split("-").map(Number);
  const [y, m, d] = today.split("-").map(Number);
  return (y - by) * 12 + m - bm - (d < bd ? 1 : 0);
}

async function sessionUser(req: Request): Promise<User | null> {
  const token = cookieValue(req.headers.cookie, sessionCookieName());
  if (!token || token.length > 200) return null;
  const db = await getDb();
  const session = await db.collection("sessions").findOne<{ user_id: string; expires_at: Date }>({ token_hash: hashSessionToken(token), expires_at: { $gt: new Date() } });
  if (!session) return null;
  const user = await db.collection<User>("users").findOne({ id: session.user_id, is_active: 1 });
  return user;
}

async function requireUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await sessionUser(req);
    if (!user) return message(res, 401, "Please sign in.");
    res.locals.user = user;
    return next();
  } catch (error) { return next(error); }
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = res.locals.user as User | undefined;
  if (user?.role !== "admin") return message(res, 403, "Administrator access is required.");
  return next();
}

async function assignedPurokIds(user: User): Promise<string[]> {
  if (user.role === "admin") return (await (await getDb()).collection<Purok>("puroks").find({}, { projection: { id: 1 } }).toArray()).map((row) => row.id);
  return (await (await getDb()).collection("purok_assignments").find({ user_id: user.id }).toArray()).map((row) => String(row.purok_id));
}

async function canAccessBarangay(user: User, barangayId: string): Promise<boolean> {
  const db = await getDb();
  if (user.role === "admin") return !!(await db.collection("barangays").findOne({ id: barangayId }));
  const assigned = await db.collection("purok_assignments").find({ user_id: user.id }).toArray();
  const ids = assigned.map((row) => String(row.purok_id));
  return !!(await db.collection("puroks").findOne({ id: { $in: ids }, barangay_id: barangayId }));
}

async function canAccessPurok(user: User, purokId: string, barangayId: string): Promise<boolean> {
  const db = await getDb();
  const purok = await db.collection<Purok>("puroks").findOne({ id: purokId, barangay_id: barangayId });
  if (!purok) return false;
  if (user.role === "admin") return true;
  return !!(await db.collection("purok_assignments").findOne({ user_id: user.id, purok_id: purokId }));
}

const router = express.Router();

router.get("/health", async (_req, res, next) => {
  try { await getDb(); return res.json({ status: "ok" }); } catch (error) { return next(error); }
});

router.get("/api/auth/setup-status", async (_req, res, next) => {
  try {
    const db = await getDb();
    return res.json({ complete: (await db.collection("users").countDocuments({ role: "admin" })) > 0 });
  } catch (error) { return next(error); }
});

router.post("/api/auth/setup-admin", async (req, res, next) => {
  try {
    const db = await getDb();
    const setupToken = process.env.ADMIN_SETUP_TOKEN;
    if (!setupToken || req.body.setupToken !== setupToken) return message(res, 403, "The setup token is invalid.");
    if (await db.collection("users").countDocuments({ role: "admin" })) return message(res, 409, "Admin setup is already complete.");
    const password = String(req.body.password ?? "");
    if (!validPassword(password) || password !== req.body.confirm) return message(res, 400, "Use a matching password of 12–128 characters.");
    const stamp = now();
    await db.collection("users").insertOne({ id: "admin", username: "admin", display_name: "Admin", role: "admin", password_hash: hashPassword(password), is_active: 1, must_change_password: 0, created_at: stamp, updated_at: stamp });
    return res.json({ message: "Admin password set. Sign in as Admin." });
  } catch (error) { return next(error); }
});

router.post("/api/auth/login", async (req, res, next) => {
  try {
    const db = await getDb();
    const username = cleanUsername(String(req.body.username ?? ""));
    const password = String(req.body.password ?? "");
    if (!username || username.length > 80 || password.length > 128) return message(res, 401, "Invalid username or password.");
    const attempt = await db.collection("login_attempts").findOne<{ failures: number; locked_until?: Date | string | null }>({ username });
    if (attempt?.locked_until && new Date(attempt.locked_until) > new Date()) return message(res, 429, "Too many attempts. Try again later.");
    const user = await db.collection<User>("users").findOne({ username });
    if (!user?.is_active || !verifyPassword(password, user.password_hash)) {
      const failures = (attempt?.failures ?? 0) + 1;
      await db.collection("login_attempts").updateOne({ username }, { $set: { failures: failures >= 5 ? 0 : failures, locked_until: failures >= 5 ? new Date(Date.now() + 15 * 60_000) : null } }, { upsert: true });
      return message(res, 401, "Invalid username or password.");
    }
    await db.collection("login_attempts").deleteOne({ username });
    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60_000);
    await db.collection("sessions").insertOne({ token_hash: hashSessionToken(token), user_id: user.id, expires_at: expiresAt });
    res.cookie(sessionCookieName(), token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", expires: expiresAt });
    return res.json({ user: publicUser(user) });
  } catch (error) { return next(error); }
});

router.get("/api/auth/me", requireUser, (_req, res) => res.json({ user: publicUser(res.locals.user as User) }));

router.post("/api/auth/logout", requireUser, async (req, res, next) => {
  try {
    const token = cookieValue(req.headers.cookie, sessionCookieName());
    if (token) await (await getDb()).collection("sessions").deleteOne({ token_hash: hashSessionToken(token) });
    res.clearCookie(sessionCookieName(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/" });
    return res.json({ message: "Signed out." });
  } catch (error) { return next(error); }
});

router.post("/api/auth/password", requireUser, async (req, res, next) => {
  try {
    const user = res.locals.user as User;
    const current = String(req.body.current ?? "");
    const nextPassword = String(req.body.next ?? "");
    if (!verifyPassword(current, user.password_hash)) return message(res, 400, "Current password is incorrect.");
    if (!validPassword(nextPassword) || nextPassword !== req.body.confirm || nextPassword === current) return message(res, 400, "Choose a different matching password of 12–128 characters.");
    const db = await getDb();
    await db.collection("users").updateOne({ id: user.id }, { $set: { password_hash: hashPassword(nextPassword), must_change_password: 0, updated_at: now() } });
    await db.collection("sessions").deleteMany({ user_id: user.id });
    res.clearCookie(sessionCookieName(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/" });
    return res.json({ message: "Password updated. Sign in again." });
  } catch (error) { return next(error); }
});

router.use("/api", requireUser);

router.get("/api/barangays", async (_req, res, next) => {
  try {
    const user = res.locals.user as User;
    const db = await getDb();
    if (user.role === "admin") return res.json({ barangays: await db.collection<Barangay>("barangays").find().sort({ name: 1 }).toArray() });
    const ids = await assignedPurokIds(user);
    const puroks = await db.collection<Purok>("puroks").find({ id: { $in: ids } }).toArray();
    const barangayIds = [...new Set(puroks.map((purok) => purok.barangay_id))];
    return res.json({ barangays: await db.collection<Barangay>("barangays").find({ id: { $in: barangayIds } }).sort({ name: 1 }).toArray() });
  } catch (error) { return next(error); }
});

router.get("/api/puroks", async (req, res, next) => {
  try {
    const user = res.locals.user as User;
    const db = await getDb();
    const query: Record<string, unknown> = {};
    if (req.query.barangay) query.barangay_id = String(req.query.barangay);
    if (user.role !== "admin") query.id = { $in: await assignedPurokIds(user) };
    return res.json({ puroks: await db.collection<Purok>("puroks").find(query).sort({ name: 1 }).toArray() });
  } catch (error) { return next(error); }
});

router.get("/api/children", async (req, res, next) => {
  try {
    const user = res.locals.user as User;
    const db = await getDb();
    const query: Record<string, unknown> = {};
    if (user.role !== "admin") query.purok_id = { $in: await assignedPurokIds(user) };
    if (req.query.barangay) query.barangay_id = String(req.query.barangay);
    const q = String(req.query.q ?? "").trim().slice(0, 80);
    if (q) query.$or = [{ name: { $regex: escapeRegExp(q), $options: "i" } }, { parents: { $regex: escapeRegExp(q), $options: "i" } }];
    const docs = await db.collection<Child>("children").find(query).sort({ name: 1, birthday: 1 }).toArray();
    const barangayIds = [...new Set(docs.map((child) => child.barangay_id))];
    const purokIds = [...new Set(docs.map((child) => child.purok_id))];
    const [barangays, puroks, assignments] = await Promise.all([
      db.collection<Barangay>("barangays").find({ id: { $in: barangayIds } }).toArray(),
      db.collection<Purok>("puroks").find({ id: { $in: purokIds } }).toArray(),
      db.collection("assignments").find({ barangay_id: { $in: barangayIds } }).toArray(),
    ]);
    const [workers, currentUserAssignments] = await Promise.all([
      db.collection<User>("users").find({ id: { $in: assignments.map((item) => String(item.user_id)) } }).toArray(),
      Promise.resolve(new Set(assignments.filter((item) => item.user_id === user.id).map((item) => String(item.barangay_id)))),
    ]);
    const barangayMap = new Map(barangays.map((item) => [item.id, item.name]));
    const purokMap = new Map(puroks.map((item) => [item.id, item.name]));
    const workersByBarangay = new Map<string, string[]>();
    for (const assignment of assignments) {
      const worker = workers.find((item) => item.id === assignment.user_id);
      if (worker) workersByBarangay.set(String(assignment.barangay_id), [...(workersByBarangay.get(String(assignment.barangay_id)) ?? []), worker.display_name]);
    }
    const children = docs.map((child) => ({ ...child, barangay_name: barangayMap.get(child.barangay_id) ?? "", purok_name: purokMap.get(child.purok_id) ?? null, bhw_names: (workersByBarangay.get(child.barangay_id) ?? []).join(", ") || null }));
    return res.json({ children, barangayIds: user.role === "admin" ? barangayIds : [...currentUserAssignments] });
  } catch (error) { return next(error); }
});

router.get("/api/admin/users", requireAdmin, async (_req, res, next) => {
  try {
    const db = await getDb();
    const users = await db.collection<User>("users").find({ role: "bhw" }).sort({ display_name: 1 }).toArray();
    const [assignments, purokAssignments] = await Promise.all([
      db.collection("assignments").find({ user_id: { $in: users.map((u) => u.id) } }).toArray(),
      db.collection("purok_assignments").find({ user_id: { $in: users.map((u) => u.id) } }).toArray(),
    ]);
    const managed = users.map((user) => ({ ...publicUser(user), assigned_ids: assignments.filter((a) => a.user_id === user.id).map((a) => String(a.barangay_id)).join(","), assigned_purok_ids: purokAssignments.filter((a) => a.user_id === user.id).map((a) => String(a.purok_id)).join(",") }));
    return res.json({ users: managed });
  } catch (error) { return next(error); }
});

router.post("/api/children", async (req, res, next) => {
  try {
    const user = res.locals.user as User;
    const { id, name, birthday, sex, parents, barangayId, purokId } = req.body;
    if (!validName(name, 120) || !validName(parents, 240) || !validBirthday(birthday) || !["F", "M"].includes(sex) || !(await canAccessBarangay(user, barangayId)) || !(await canAccessPurok(user, purokId, barangayId))) return message(res, 400, "Check the child details and assigned barangay/Purok.");
    const db = await getDb();
    const stamp = now();
    const child: Child = { id: id || randomUUID(), name: name.trim(), birthday, sex, parents: parents.trim(), barangay_id: barangayId, purok_id: purokId, created_by: user.id, created_at: stamp, updated_at: stamp };
    if (id) {
      const existing = await db.collection<Child>("children").findOne({ id });
      if (!existing || !(await canAccessPurok(user, existing.purok_id, existing.barangay_id))) return message(res, 404, "Record unavailable.");
      child.created_by = existing.created_by;
      child.created_at = existing.created_at;
      await db.collection<Child>("children").replaceOne({ id }, child);
      return res.json({ message: "Child record updated." });
    }
    await db.collection<Child>("children").insertOne(child);
    return res.json({ message: "Child record added." });
  } catch (error) { return next(error); }
});

router.post("/api/admin/barangays", requireAdmin, async (req, res, next) => {
  try {
    const name = String(req.body.name ?? "").trim();
    if (!validName(name)) return message(res, 400, "Enter a barangay name under 100 characters.");
    const db = await getDb();
    if (await db.collection("barangays").findOne({ name: { $regex: `^${escapeRegExp(name)}$`, $options: "i" } })) return message(res, 409, "Barangay already exists.");
    await db.collection<Barangay>("barangays").insertOne({ id: randomUUID(), name, created_at: now() });
    return res.json({ message: "Barangay added." });
  } catch (error) { return next(error); }
});

router.put("/api/admin/barangays/:id", requireAdmin, async (req, res, next) => {
  try {
    const barangayId = String(req.params.id);
    const name = String(req.body.name ?? "").trim();
    if (!validName(name)) return message(res, 400, "Enter a barangay name under 100 characters.");
    const db = await getDb();
    const duplicate = await db.collection<Barangay>("barangays").findOne({ id: { $ne: barangayId }, name: { $regex: `^${escapeRegExp(name)}$`, $options: "i" } });
    if (duplicate) return message(res, 409, "Barangay already exists.");
    const result = await db.collection<Barangay>("barangays").updateOne({ id: barangayId }, { $set: { name } });
    return result.matchedCount ? res.json({ message: "Barangay updated." }) : message(res, 404, "Barangay unavailable.");
  } catch (error) { return next(error); }
});

router.delete("/api/admin/barangays/:id", requireAdmin, async (req, res, next) => {
  try {
    const barangayId = String(req.params.id);
    const db = await getDb();
    const barangay = await db.collection<Barangay>("barangays").findOne({ id: barangayId });
    if (!barangay) return message(res, 404, "Barangay unavailable.");
    const [puroks, children, assignedWorkers] = await Promise.all([
      db.collection<Purok>("puroks").countDocuments({ barangay_id: barangayId }),
      db.collection<Child>("children").countDocuments({ barangay_id: barangayId }),
      db.collection("assignments").countDocuments({ barangay_id: barangayId }),
    ]);
    if (puroks || children || assignedWorkers) {
      const reasons = [
        puroks && `${puroks} Purok${puroks === 1 ? "" : "s"}`,
        children && `${children} child record${children === 1 ? "" : "s"}`,
        assignedWorkers && `${assignedWorkers} BHW assignment${assignedWorkers === 1 ? "" : "s"}`,
      ].filter(Boolean);
      return message(res, 409, `Cannot delete ${barangay.name} while it has ${reasons.join(", ")}. Remove or reassign them first.`);
    }
    await db.collection<Barangay>("barangays").deleteOne({ id: barangayId });
    return res.json({ message: `Barangay ${barangay.name} deleted.` });
  } catch (error) { return next(error); }
});

router.post("/api/admin/puroks", requireAdmin, async (req, res, next) => {
  try {
    const barangayId = String(req.body.barangayId ?? "");
    const name = String(req.body.name ?? "").trim();
    if (!validName(name) || !(await canAccessBarangay(res.locals.user as User, barangayId))) return message(res, 400, "Enter a Purok name and select its barangay.");
    const db = await getDb();
    if (await db.collection<Purok>("puroks").findOne({ barangay_id: barangayId, name: { $regex: `^${escapeRegExp(name)}$`, $options: "i" } })) return message(res, 409, "That Purok already exists in this barangay.");
    await db.collection<Purok>("puroks").insertOne({ id: randomUUID(), name, barangay_id: barangayId, created_at: now() });
    return res.json({ message: "Purok added." });
  } catch (error) { return next(error); }
});

router.put("/api/admin/puroks/:id", requireAdmin, async (req, res, next) => {
  try {
    const name = String(req.body.name ?? "").trim();
    if (!validName(name)) return message(res, 400, "Enter a Purok name under 100 characters.");
    const db = await getDb();
    const current = await db.collection<Purok>("puroks").findOne({ id: req.params.id });
    if (!current) return message(res, 404, "Purok unavailable.");
    if (await db.collection<Purok>("puroks").findOne({ id: { $ne: current.id }, barangay_id: current.barangay_id, name: { $regex: `^${escapeRegExp(name)}$`, $options: "i" } })) return message(res, 409, "That Purok already exists in this barangay.");
    await db.collection<Purok>("puroks").updateOne({ id: current.id }, { $set: { name } });
    return res.json({ message: "Purok updated." });
  } catch (error) { return next(error); }
});

router.delete("/api/admin/puroks/:id", requireAdmin, async (req, res, next) => {
  try {
    const db = await getDb();
    const purok = await db.collection<Purok>("puroks").findOne({ id: req.params.id });
    if (!purok) return message(res, 404, "Purok unavailable.");
    const [children, assignedWorkers] = await Promise.all([
      db.collection<Child>("children").countDocuments({ purok_id: purok.id }),
      db.collection("purok_assignments").countDocuments({ purok_id: purok.id }),
    ]);
    if (children || assignedWorkers) {
      const reasons = [
        children && `${children} child record${children === 1 ? "" : "s"}`,
        assignedWorkers && `${assignedWorkers} BHW assignment${assignedWorkers === 1 ? "" : "s"}`,
      ].filter(Boolean);
      return message(res, 409, `Cannot delete Purok ${purok.name} while it has ${reasons.join(" and ")}. Reassign or remove them first.`);
    }
    await db.collection<Purok>("puroks").deleteOne({ id: purok.id });
    return res.json({ message: `Purok ${purok.name} deleted.` });
  } catch (error) { return next(error); }
});

router.post("/api/admin/users", requireAdmin, async (req, res, next) => {
  try {
    const username = cleanUsername(String(req.body.username ?? ""));
    const displayName = String(req.body.displayName ?? "").trim();
    const password = String(req.body.temporaryPassword ?? "");
    if (!/^[a-z0-9._-]{3,40}$/.test(username) || !validName(displayName) || !validPassword(password)) return message(res, 400, "Use a valid username, name, and temporary password of 12–128 characters.");
    const db = await getDb();
    if (await db.collection("users").findOne({ username })) return message(res, 409, "Username already exists.");
    const stamp = now();
    await db.collection<User>("users").insertOne({ id: randomUUID(), username, display_name: displayName, role: "bhw", password_hash: hashPassword(password), is_active: 1, must_change_password: 1, created_at: stamp, updated_at: stamp });
    return res.json({ message: "BHW account created. Assign a barangay/Purok before use." });
  } catch (error) { return next(error); }
});

router.put("/api/admin/users/:id/assignments", requireAdmin, async (req, res, next) => {
  try {
    const userId = req.params.id;
    const db = await getDb();
    if (!(await db.collection<User>("users").findOne({ id: userId, role: "bhw" }))) return message(res, 404, "BHW account unavailable.");
    const barangayIds = stringIds(req.body.barangayIds);
    const purokIds = stringIds(req.body.purokIds);
    const puroks = await db.collection<Purok>("puroks").find({ id: { $in: purokIds }, barangay_id: { $in: barangayIds } }).toArray();
    if (puroks.length !== purokIds.length || (await db.collection<Barangay>("barangays").countDocuments({ id: { $in: barangayIds } })) !== barangayIds.length) return message(res, 400, "Invalid barangay or Purok assignment.");
    if (barangayIds.length) await db.collection("assignments").bulkWrite(barangayIds.map((barangay_id) => ({
      updateOne: { filter: { user_id: userId, barangay_id }, update: { $setOnInsert: { user_id: userId, barangay_id } }, upsert: true },
    })));
    if (purokIds.length) await db.collection("purok_assignments").bulkWrite(purokIds.map((purok_id) => ({
      updateOne: { filter: { user_id: userId, purok_id }, update: { $setOnInsert: { user_id: userId, purok_id } }, upsert: true },
    })));
    await Promise.all([
      db.collection("assignments").deleteMany({ user_id: userId, barangay_id: { $nin: barangayIds } }),
      db.collection("purok_assignments").deleteMany({ user_id: userId, purok_id: { $nin: purokIds } }),
    ]);
    return res.json({ message: "Barangay and Purok assignments saved." });
  } catch (error) { return next(error); }
});

router.post("/api/admin/users/:id/password", requireAdmin, async (req, res, next) => {
  try {
    const password = String(req.body.temporaryPassword ?? "");
    if (!validPassword(password)) return message(res, 400, "Temporary password must be 12–128 characters.");
    const db = await getDb();
    const result = await db.collection<User>("users").updateOne({ id: req.params.id, role: "bhw" }, { $set: { password_hash: hashPassword(password), must_change_password: 1, updated_at: now() } });
    if (!result.matchedCount) return message(res, 404, "BHW account unavailable.");
    await db.collection("sessions").deleteMany({ user_id: req.params.id });
    return res.json({ message: "Temporary password set. Activate the account if needed." });
  } catch (error) { return next(error); }
});

router.put("/api/admin/users/:id/active", requireAdmin, async (req, res, next) => {
  try {
    const active = !!req.body.active;
    const db = await getDb();
    const user = await db.collection<User>("users").findOne({ id: req.params.id, role: "bhw" });
    if (!user) return message(res, 404, "BHW account unavailable.");
    if (active && !user.password_hash) return message(res, 400, "Set a temporary password before activation.");
    await db.collection("users").updateOne({ id: user.id }, { $set: { is_active: active ? 1 : 0, updated_at: now() } });
    if (!active) await db.collection("sessions").deleteMany({ user_id: user.id });
    return res.json({ message: active ? "BHW account reactivated." : "BHW account deactivated." });
  } catch (error) { return next(error); }
});

router.get("/api/export/xlsx", async (req, res, next) => {
  try {
    const user = res.locals.user as User;
    if (user.must_change_password) return message(res, 403, "Change your password before exporting.");
    const db = await getDb();
    const requestedBarangay = req.query.barangay ? String(req.query.barangay) : "";
    if (requestedBarangay && !(await canAccessBarangay(user, requestedBarangay))) return message(res, 403, "This barangay is not assigned to your account.");
    const query: Record<string, unknown> = {};
    if (user.role !== "admin") query.purok_id = { $in: await assignedPurokIds(user) };
    if (req.query.barangay) query.barangay_id = String(req.query.barangay);
    const q = String(req.query.q ?? "").trim().slice(0, 80);
    if (q) query.$or = [{ name: { $regex: escapeRegExp(q), $options: "i" } }, { parents: { $regex: escapeRegExp(q), $options: "i" } }];
    const children = await db.collection<Child>("children").find(query).sort({ name: 1, birthday: 1 }).toArray();
    const assignedPuroks = user.role === "admin" ? [] : await db.collection<Purok>("puroks").find({ id: { $in: await assignedPurokIds(user) } }).toArray();
    const assignedBarangayIds = [...new Set(assignedPuroks.map((purok) => purok.barangay_id))];
    const barangays = await db.collection<Barangay>("barangays").find(user.role === "admin" ? (requestedBarangay ? { id: requestedBarangay } : {}) : { id: requestedBarangay ? requestedBarangay : { $in: assignedBarangayIds } }).sort({ name: 1 }).toArray();
    const puroks = await db.collection<Purok>("puroks").find({ id: { $in: [...new Set(children.map((c) => c.purok_id))] } }).toArray();
    const barangayName = new Map(barangays.map((item) => [item.id, item.name]));
    const purokName = new Map(puroks.map((item) => [item.id, item.name]));
    const selected = barangays.map((item) => item.name.toUpperCase());
    const title = `${selected.length === 1 ? "BARANGAY" : "BARANGAYS"} ${selected.join(", ")}, MINGLANILLA, CEBU`;
    const rows = children.map((child, index) => [`${index + 1}.`, child.name, child.birthday, purokName.get(child.purok_id) ?? "", ageInMonths(child.birthday, todayInManila()), child.sex, "", "", "", "", child.parents]);
    const file = makeWorkbook(title, rows);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="vitamin-a-deworming-${todayInManila()}.xlsx"`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(Buffer.from(file));
  } catch (error) { return next(error); }
});

function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use((req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    const expectedOrigin = process.env.FRONTEND_ORIGIN;
    if (origin && expectedOrigin && new URL(origin).origin !== new URL(expectedOrigin).origin) return message(res, 403, "Invalid request origin.");
  }
  return next();
});
app.use(router);
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const detail = error instanceof Error ? error.message : "Unknown server error";
  console.error("API request failed", detail);
  return message(res, 500, "The server could not complete this request.");
});
