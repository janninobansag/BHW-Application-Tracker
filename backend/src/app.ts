import express, { type NextFunction, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";
import { cleanUsername, cookieValue, createSessionToken, equalSecret, hashPassword, hashSessionToken, sessionCookieName, validPassword, verifyPassword } from "./security.js";
import { makeWorkbook } from "./workbook.js";
import { makePrintReport } from "./print-report.js";
import { authRateLimit, browserRequestSecurity, responseSecurity, validId, validateJsonRequest } from "./request-security.js";
import { parseMeasurements, type Measurements } from "./timbang.js";
import { parseHouseholdProfile, type HouseholdProfile } from "./household-profile.js";
import { makeHouseholdProfilePdf } from "./household-print.js";

type User = { id: string; username: string; display_name: string; role: "admin" | "bhw"; password_hash?: string | null; is_active: number; must_change_password: number; created_at?: string; updated_at?: string };
type UserPublic = Omit<User, "password_hash">;
type Barangay = { id: string; name: string; created_at?: string };
type Sitio = { id: string; name: string; barangay_id: string; created_at?: string };
type Purok = { id: string; name: string; barangay_id: string; created_at?: string };
type Child = { id: string; name: string; surname?: string; first_name?: string; middle_initial?: string; birthday: string; sex: "F" | "M"; parents: string; barangay_id: string; purok_id: string; created_by: string; created_at: string; updated_at: string } & Partial<Measurements>;
const recordCollection = (req: Request) => req.path.startsWith("/api/operation-timbang") ? "operation_timbang" : "children";
const now = () => new Date().toISOString();
const publicUser = (user: User): UserPublic => {
  const { password_hash: _passwordHash, ...result } = user;
  return result;
};
const message = (res: Response, status: number, text: string) => res.status(status).json({ message: text });
const dummyPasswordHash = hashPassword(randomUUID());

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
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day && value <= todayInManila();
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

router.post("/api/auth/setup-admin", authRateLimit("setup", 10, 15 * 60_000), async (req, res, next) => {
  try {
    const db = await getDb();
    const setupToken = process.env.ADMIN_SETUP_TOKEN;
    if (!equalSecret(req.body.setupToken, setupToken)) return message(res, 403, "The setup token is invalid.");
    if (await db.collection("users").countDocuments({ role: "admin" })) return message(res, 409, "Admin setup is already complete.");
    const password = String(req.body.password ?? "");
    if (!validPassword(password) || password !== req.body.confirm) return message(res, 400, "Use a matching password of 12–128 characters.");
    const stamp = now();
    await db.collection("users").insertOne({ id: "admin", username: "admin", display_name: "Admin", role: "admin", password_hash: hashPassword(password), is_active: 1, must_change_password: 0, created_at: stamp, updated_at: stamp });
    return res.json({ message: "Admin password set. Sign in as Admin." });
  } catch (error) { return next(error); }
});

router.post("/api/auth/login", authRateLimit("login-global", 120, 60_000), authRateLimit("login-account", 20, 15 * 60_000, (req) => cleanUsername(String(req.body.username ?? ""))), async (req, res, next) => {
  try {
    const db = await getDb();
    const username = cleanUsername(String(req.body.username ?? ""));
    const password = String(req.body.password ?? "");
    if (!username || username.length > 80 || password.length > 128) return message(res, 401, "Invalid username or password.");
    const attempt = await db.collection("login_attempts").findOne<{ failures: number; locked_until?: Date | string | null }>({ username });
    if (attempt?.locked_until && new Date(attempt.locked_until) > new Date()) {
      res.set("Retry-After", String(Math.max(1, Math.ceil((new Date(attempt.locked_until).getTime() - Date.now()) / 1000))));
      return message(res, 429, "Too many attempts. Try again later.");
    }
    const user = await db.collection<User>("users").findOne({ username });
    const matches = verifyPassword(password, user?.password_hash || dummyPasswordHash);
    if (!user?.is_active || !matches) {
      // Atomic increments prevent parallel failed requests from losing failures.
      const failureUpdate = [{ $set: {
        failures: { $add: [{ $cond: [{ $gt: ["$expires_at", "$$NOW"] }, { $ifNull: ["$failures", 0] }, 0] }, 1] },
        expires_at: new Date(Date.now() + 15 * 60_000),
      } }, { $set: { locked_until: { $cond: [{ $gte: ["$failures", 5] }, new Date(Date.now() + 15 * 60_000), null] } } }];
      try {
        await db.collection("login_attempts").updateOne({ username }, failureUpdate, { upsert: true });
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error;
        await db.collection("login_attempts").updateOne({ username }, failureUpdate);
      }
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

router.post("/api/auth/password", requireUser, authRateLimit("password", 10, 15 * 60_000, (_req, res) => (res.locals.user as User).id), async (req, res, next) => {
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
router.use("/api", (_req, res, next) => {
  if ((res.locals.user as User).must_change_password) return message(res, 403, "Change your temporary password before accessing records.");
  return next();
});

router.get("/api/notifications/age/read", async (_req, res, next) => {
  try {
    const user = res.locals.user as User;
    const receipts = await (await getDb()).collection("notification_reads").find({ user_id: user.id, expires_at: { $gt: new Date() } }, { projection: { notice_id: 1 } }).toArray();
    return res.json({ userId: user.id, readIds: receipts.map((receipt) => String(receipt.notice_id)) });
  } catch (error) { return next(error); }
});

router.put("/api/notifications/age/read", async (req, res, next) => {
  try {
    const user = res.locals.user as User;
    const input: unknown = req.body.ids;
    if (!Array.isArray(input) || input.length > 500 || input.some((id) => typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,160}:\d{4}-\d{2}-\d{2}$/.test(id))) return message(res, 400, "Invalid notification IDs.");
    const today = todayInManila();
    const earliest = new Date(`${today}T12:00:00Z`);
    earliest.setUTCDate(earliest.getUTCDate() - 30);
    const cutoff = earliest.toISOString().slice(0, 10);
    const ids = [...new Set(input as string[])].filter((id) => {
      const date = id.slice(id.lastIndexOf(":") + 1);
      return validBirthday(date) && date >= cutoff;
    });
    const db = await getDb();
    const childIds = ids.map((id) => id.slice(0, id.lastIndexOf(":")));
    const query = { id: { $in: childIds }, ...(user.role === "admin" ? {} : { purok_id: { $in: await assignedPurokIds(user) } }) };
    const children = new Map((await db.collection<Child>("children").find(query).toArray()).map((child) => [child.id, child]));
    const accepted = ids.filter((id) => {
      const child = children.get(id.slice(0, id.lastIndexOf(":")));
      const date = id.slice(id.lastIndexOf(":") + 1);
      const previous = new Date(`${date}T12:00:00Z`);
      previous.setUTCDate(previous.getUTCDate() - 1);
      const before = previous.toISOString().slice(0, 10);
      return child && child.birthday <= before && ageInMonths(child.birthday, date) > ageInMonths(child.birthday, before);
    });
    // Atomic, idempotent receipts are scoped to the authenticated account.
    // Keep them beyond the seven-day notice window, then expire automatically.
    const updates = accepted.map((noticeId) => {
      const expiresAt = new Date(`${noticeId.slice(noticeId.lastIndexOf(":") + 1)}T00:00:00Z`);
      expiresAt.setUTCDate(expiresAt.getUTCDate() + 45);
      const filter = { user_id: user.id, notice_id: noticeId };
      return { updateOne: { filter, update: { $setOnInsert: { ...filter, read_at: new Date(), expires_at: expiresAt } }, upsert: true } };
    });
    if (updates.length) {
      try {
        await db.collection("notification_reads").bulkWrite(updates, { ordered: false });
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error;
      }
    }
    return res.json({ userId: user.id, readIds: accepted });
  } catch (error) { return next(error); }
});

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

router.get("/api/sitios", async (req, res, next) => {
  try {
    const user = res.locals.user as User;
    const db = await getDb();
    const requestedBarangay = req.query.barangay ? String(req.query.barangay) : "";
    const query: Record<string, unknown> = {};
    if (user.role === "admin") {
      if (requestedBarangay) query.barangay_id = requestedBarangay;
    } else {
      const ids = await assignedPurokIds(user);
      const assignedPuroks = await db.collection<Purok>("puroks").find({ id: { $in: ids } }).toArray();
      const barangayIds = [...new Set(assignedPuroks.map((purok) => purok.barangay_id))];
      query.barangay_id = requestedBarangay
        ? (barangayIds.includes(requestedBarangay) ? requestedBarangay : { $in: [] })
        : { $in: barangayIds };
    }
    return res.json({ sitios: await db.collection<Sitio>("sitios").find(query).sort({ name: 1 }).toArray() });
  } catch (error) { return next(error); }
});

router.get(["/api/children", "/api/operation-timbang"], async (req, res, next) => {
  try {
    const user = res.locals.user as User;
    const db = await getDb();
    const query: Record<string, unknown> = {};
    const requestedBarangay = req.query.barangay ? String(req.query.barangay) : "";
    const requestedPurok = req.query.purok ? String(req.query.purok) : "";
    if (user.role !== "admin") query.purok_id = { $in: await assignedPurokIds(user) };
    if (requestedBarangay) query.barangay_id = requestedBarangay;
    if (requestedPurok) {
      const purok = await db.collection<Purok>("puroks").findOne({ id: requestedPurok });
      if (!purok) return message(res, 400, "Choose a valid Purok.");
      if (requestedBarangay && requestedBarangay !== purok.barangay_id) return message(res, 400, "The selected Purok does not belong to that barangay.");
      if (!(await canAccessPurok(user, requestedPurok, purok.barangay_id))) return message(res, 403, "This Purok is not assigned to your account.");
      query.barangay_id = purok.barangay_id;
      query.purok_id = purok.id;
    }
    const q = String(req.query.q ?? "").trim().slice(0, 80);
    if (q) query.$or = [{ name: { $regex: escapeRegExp(q), $options: "i" } }, { parents: { $regex: escapeRegExp(q), $options: "i" } }];
    const docs = await db.collection<Child>(recordCollection(req)).find(query).sort({ name: 1, birthday: 1 }).toArray();
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

router.get("/api/households", async (_req, res, next) => {
  try {
    const user = res.locals.user as User;
    const db = await getDb();
    const query = user.role === "admin" ? {} : { purokId: { $in: await assignedPurokIds(user) } };
    const profiles = await db.collection<HouseholdProfile>("household_profiles").find(query).sort({ updated_at: -1 }).toArray();
    const [barangays, puroks, sitios, workers] = await Promise.all([
      db.collection<Barangay>("barangays").find({ id: { $in: [...new Set(profiles.map((item) => item.barangayId))] } }).toArray(),
      db.collection<Purok>("puroks").find({ id: { $in: [...new Set(profiles.map((item) => item.purokId))] } }).toArray(),
      db.collection<Sitio>("sitios").find({ id: { $in: [...new Set(profiles.map((item) => item.sitioId).filter(Boolean))] } }).toArray(),
      db.collection<User>("users").find({ id: { $in: [...new Set(profiles.map((item) => item.created_by))] } }).toArray(),
    ]);
    const names = (items: Array<{ id: string; name: string }>) => new Map(items.map((item) => [item.id, item.name]));
    const barangayNames = names(barangays), purokNames = names(puroks), sitioNames = names(sitios);
    const workerNames = new Map(workers.map((item) => [item.id, item.display_name]));
    return res.json({ households: profiles.map((profile) => ({ ...profile, barangay_name: barangayNames.get(profile.barangayId) ?? "", purok_name: purokNames.get(profile.purokId) ?? "", sitio_name: sitioNames.get(profile.sitioId) ?? "", worker_name: workerNames.get(profile.created_by) ?? "" })) });
  } catch (error) { return next(error); }
});

router.get("/api/households/:id", async (req, res, next) => {
  try {
    const user = res.locals.user as User;
    const household = await (await getDb()).collection<HouseholdProfile>("household_profiles").findOne({ id: req.params.id });
    if (!household || !(await canAccessPurok(user, household.purokId, household.barangayId))) return message(res, 404, "Household unavailable.");
    return res.json({ household });
  } catch (error) { return next(error); }
});

router.get("/api/households/:id/pdf", async (req, res, next) => {
  try {
    const user = res.locals.user as User;
    const db = await getDb();
    const profile = await db.collection<HouseholdProfile>("household_profiles").findOne({ id: req.params.id });
    if (!profile || !(await canAccessPurok(user, profile.purokId, profile.barangayId))) return message(res, 404, "Household unavailable.");
    const [barangay, purok, sitio] = await Promise.all([
      db.collection<Barangay>("barangays").findOne({ id: profile.barangayId }),
      db.collection<Purok>("puroks").findOne({ id: profile.purokId }),
      profile.sitioId ? db.collection<Sitio>("sitios").findOne({ id: profile.sitioId }) : null,
    ]);
    const file = Buffer.from(await makeHouseholdProfilePdf({ ...profile, barangay_name: barangay?.name ?? "", purok_name: purok?.name ?? "", sitio_name: sitio?.name ?? "" }));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="household-profile-${profile.id}.pdf"`);
    res.setHeader("Content-Length", String(file.length));
    return res.end(file);
  } catch (error) { return next(error); }
});

router.post("/api/households", async (req, res, next) => {
  try {
    const user = res.locals.user as User;
    if (req.body.offlineUserId && (user.role !== "bhw" || req.body.offlineUserId !== user.id)) return message(res, 403, "Sign in to the worker account that saved this household.");
    const input = parseHouseholdProfile(req.body);
    if (!input) return message(res, 400, "Check the household details and member fields.");
    if (!(await canAccessPurok(user, input.purokId, input.barangayId))) return message(res, 403, "This Purok is not assigned to your account.");
    const db = await getDb();
    if (input.sitioId && !(await db.collection<Sitio>("sitios").findOne({ id: input.sitioId, barangay_id: input.barangayId }))) return message(res, 400, "Choose a Sitio in the selected barangay.");
    const id = req.body.id || randomUUID();
    if (!validId(id)) return message(res, 400, "Invalid household ID.");
    const current = await db.collection<HouseholdProfile>("household_profiles").findOne({ id });
    const expected = req.body.expectedUpdatedAt;
    if (current) {
      if (!(await canAccessPurok(user, current.purokId, current.barangayId))) return message(res, 404, "Household unavailable.");
      if (typeof expected !== "string" || current.updated_at !== expected) {
        if (expected === null && current.created_by === user.id && JSON.stringify(parseHouseholdProfile(current)) === JSON.stringify(input)) return res.json({ message: "Household already synced.", household: current });
        return message(res, 409, "This household changed online. Reload it before saving.");
      }
      const updated: HouseholdProfile = { ...input, id, created_by: current.created_by, created_at: current.created_at, updated_at: now() };
      const result = await db.collection<HouseholdProfile>("household_profiles").replaceOne({ id, updated_at: expected }, updated);
      if (!result.matchedCount) return message(res, 409, "This household changed online. Reload it before saving.");
      return res.json({ message: "Household updated.", household: updated });
    }
    if (expected !== undefined && expected !== null) return message(res, 409, "This household no longer exists online.");
    const created: HouseholdProfile = { ...input, id, created_by: user.id, created_at: now(), updated_at: now() };
    await db.collection<HouseholdProfile>("household_profiles").insertOne(created);
    return res.json({ message: "Household added.", household: created });
  } catch (error) { return next(error); }
});

router.delete("/api/households/:id", async (req, res, next) => {
  try {
    const user = res.locals.user as User;
    const db = await getDb();
    const current = await db.collection<HouseholdProfile>("household_profiles").findOne({ id: req.params.id });
    if (!current) return req.body.offlineUserId === user.id && user.role === "bhw" ? res.json({ message: "Household already deleted." }) : message(res, 404, "Household unavailable.");
    if (!(await canAccessPurok(user, current.purokId, current.barangayId))) return message(res, 404, "Household unavailable.");
    if (req.body.offlineUserId && (user.role !== "bhw" || req.body.offlineUserId !== user.id)) return message(res, 403, "Sign in to the worker account that saved this household.");
    if (req.body.expectedUpdatedAt !== current.updated_at && !(req.body.offlineUserId === user.id && req.body.expectedUpdatedAt === null && current.created_by === user.id && JSON.stringify(parseHouseholdProfile(current)) === JSON.stringify(parseHouseholdProfile(req.body.offlineCreatedHousehold)))) return message(res, 409, "This household changed online. Reload it before deleting.");
    const result = await db.collection<HouseholdProfile>("household_profiles").deleteOne({ id: current.id, updated_at: current.updated_at });
    if (!result.deletedCount) return message(res, 409, "This household changed online. Reload it before deleting.");
    return res.json({ message: "Household deleted." });
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

router.get("/api/admin/users/:id/records", requireAdmin, async (req, res, next) => {
  try {
    const program = req.query.program === undefined ? "all" : req.query.program;
    const requestedPage = req.query.page === undefined ? 1 : Number(req.query.page);
    if (!["all", "deworming", "timbang"].includes(program as string) || !Number.isSafeInteger(requestedPage) || requestedPage < 1) {
      return message(res, 400, "Choose a valid program and page.");
    }
    const db = await getDb();
    const workerId = String(req.params.id);
    const worker = await db.collection<User>("users").findOne({ id: workerId, role: "bhw" });
    if (!worker) return message(res, 404, "BHW account unavailable.");

    const [deworming, timbang] = await Promise.all([
      db.collection<Child>("children").countDocuments({ created_by: workerId }),
      db.collection<Child>("operation_timbang").countDocuments({ created_by: workerId }),
    ]);
    const total = program === "deworming" ? deworming : program === "timbang" ? timbang : deworming + timbang;
    const pageSize = 10;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, pageCount);
    const selectRecords = (label: string) => [
      { $match: { created_by: workerId } },
      { $project: { _id: 0, id: 1, name: 1, created_at: 1, barangay_id: 1, purok_id: 1, program: { $literal: label } } },
    ];
    const firstCollection = program === "timbang" ? "operation_timbang" : "children";
    const pipeline: Record<string, unknown>[] = selectRecords(program === "timbang" ? "timbang" : "deworming");
    if (program === "all") pipeline.push({ $unionWith: { coll: "operation_timbang", pipeline: selectRecords("timbang") } });
    pipeline.push({ $sort: { created_at: -1, id: -1, program: 1 } }, { $skip: (page - 1) * pageSize }, { $limit: pageSize });
    const rows = await db.collection<Child>(firstCollection).aggregate<{ id: string; name: string; created_at: string; barangay_id: string; purok_id: string; program: "deworming" | "timbang" }>(pipeline).toArray();
    const [barangays, puroks] = await Promise.all([
      db.collection<Barangay>("barangays").find({ id: { $in: [...new Set(rows.map((row) => row.barangay_id))] } }).toArray(),
      db.collection<Purok>("puroks").find({ id: { $in: [...new Set(rows.map((row) => row.purok_id))] } }).toArray(),
    ]);
    const barangayNames = new Map(barangays.map((item) => [item.id, item.name]));
    const purokNames = new Map(puroks.map((item) => [item.id, item.name]));
    return res.json({
      worker: { id: worker.id, display_name: worker.display_name, username: worker.username, is_active: worker.is_active },
      counts: { deworming, timbang, total: deworming + timbang },
      records: rows.map((row) => ({ id: row.id, name: row.name, created_at: row.created_at, program: row.program, barangay_name: barangayNames.get(row.barangay_id) ?? "Barangay removed", purok_name: purokNames.get(row.purok_id) ?? "Purok removed" })),
      page,
      pageCount,
      filteredTotal: total,
    });
  } catch (error) { return next(error); }
});

router.post(["/api/children", "/api/operation-timbang"], async (req, res, next) => {
  try {
    const user = res.locals.user as User;
    if (req.body.offlineUserId && (req.body.offlineUserId !== user.id || user.role !== "bhw")) return message(res, 403, "Sign in to the worker account that saved these offline changes.");
    const { id, name, givenName, firstName, middleInitial, surname, birthday, sex, parents, barangayId, purokId, expectedUpdatedAt, updatedAt } = req.body;
    const newName = Object.prototype.hasOwnProperty.call(req.body, "firstName") || Object.prototype.hasOwnProperty.call(req.body, "middleInitial");
    const separateName = newName || Object.prototype.hasOwnProperty.call(req.body, "givenName") || Object.prototype.hasOwnProperty.call(req.body, "surname");
    const cleanGivenName = typeof givenName === "string" ? givenName.trim().replace(/\s+/gu, " ") : "";
    const cleanFirstName = typeof firstName === "string" ? firstName.trim().replace(/\s+/gu, " ") : "";
    const inputInitial = typeof middleInitial === "string" ? middleInitial.trim() : "";
    const cleanInitial = inputInitial ? `${[...inputInitial][0].toLocaleUpperCase("en-PH")}.` : "";
    const cleanSurname = typeof surname === "string" ? surname.trim().replace(/\s+/gu, " ") : "";
    const fullName = newName ? [cleanFirstName, cleanInitial, cleanSurname].filter(Boolean).join(" ") : separateName ? `${cleanGivenName} ${cleanSurname}`.trim() : name;
    const hasOfflineVersion = Object.prototype.hasOwnProperty.call(req.body, "expectedUpdatedAt");
    const expectedVersion = hasOfflineVersion ? expectedUpdatedAt : updatedAt;
    const hasExpectedVersion = hasOfflineVersion || (typeof updatedAt === "string" && updatedAt.length > 0);
    const measurements = recordCollection(req) === "operation_timbang" ? parseMeasurements(req.body) : {};
    if (!measurements) return message(res, 400, "Enter weight, height, and MUAC as positive numbers up to 1000 with at most two decimal places, or leave them blank.");
    if ((newName && (!validName(cleanFirstName, 100) || (inputInitial && !/^\p{L}\.?$/u.test(inputInitial)))) || (separateName && (!validName(cleanSurname, 100) || (!newName && !validName(cleanGivenName, 100)))) || !validName(fullName, 120) || !validName(parents, 240) || !validBirthday(birthday) || !["F", "M"].includes(sex) || !(await canAccessBarangay(user, barangayId)) || !(await canAccessPurok(user, purokId, barangayId))) return message(res, 400, "Check the child details and assigned barangay/Purok.");
    const db = await getDb();
    const stamp = now();
    const child: Child = { id: id || randomUUID(), name: fullName.trim(), ...(separateName ? { surname: cleanSurname } : {}), ...(newName ? { first_name: cleanFirstName, middle_initial: cleanInitial } : {}), birthday, sex, parents: parents.trim(), barangay_id: barangayId, purok_id: purokId, created_by: user.id, created_at: stamp, updated_at: stamp, ...measurements };
    if (id) {
      const existing = await db.collection<Child>(recordCollection(req)).findOne({ id });
      if (!existing) {
        if (!hasOfflineVersion) return message(res, 404, "Record unavailable.");
        if (expectedUpdatedAt !== null) return message(res, 409, "This record no longer exists online. Review your offline copy before syncing.");
        await db.collection<Child>(recordCollection(req)).insertOne(child);
        return res.json({ message: "Child record added.", child });
      }
      if (!(await canAccessPurok(user, existing.purok_id, existing.barangay_id))) return message(res, 404, "Record unavailable.");
      if (hasOfflineVersion && expectedUpdatedAt === null) {
        const sameOfflineCreate = existing.created_by === user.id && existing.name === child.name && existing.surname === child.surname && existing.first_name === child.first_name && existing.middle_initial === child.middle_initial && existing.birthday === child.birthday && existing.sex === child.sex && existing.parents === child.parents && existing.barangay_id === child.barangay_id && existing.purok_id === child.purok_id && (recordCollection(req) !== "operation_timbang" || ["weight", "height", "muac"].every((key) => existing[key as keyof Measurements] === child[key as keyof Measurements]));
        return sameOfflineCreate ? res.json({ message: "Child record was already synced.", child: existing }) : message(res, 409, "A record with this offline ID already exists with different details.");
      }
      if (hasExpectedVersion && (typeof expectedVersion !== "string" || existing.updated_at !== expectedVersion)) return message(res, 409, hasOfflineVersion ? "This record changed online after your offline copy was saved." : "This record changed after you opened it. Reload the record before saving again.");
      child.created_by = existing.created_by;
      child.created_at = existing.created_at;
      const filter = hasExpectedVersion ? { id, updated_at: existing.updated_at } : { id };
      const saved = await db.collection<Child>(recordCollection(req)).replaceOne(filter, child);
      if (!saved.matchedCount) return message(res, 409, hasOfflineVersion ? "This record changed online after your offline copy was saved." : "This record changed after you opened it. Reload the record before saving again.");
      return res.json({ message: "Child record updated.", child });
    }
    await db.collection<Child>(recordCollection(req)).insertOne(child);
    return res.json({ message: "Child record added.", child });
  } catch (error) { return next(error); }
});

router.delete(["/api/children/:id", "/api/operation-timbang/:id"], async (req, res, next) => {
  try {
    const user = res.locals.user as User;
    const offlineDelete = Boolean(req.body.offlineUserId);
    if (offlineDelete && (req.body.offlineUserId !== user.id || user.role !== "bhw")) return message(res, 403, "Sign in to the worker account that saved these offline changes.");
    const id = String(req.params.id);
    const updatedAt = typeof req.body.updatedAt === "string" ? req.body.updatedAt : "";
    const db = await getDb();
    const child = await db.collection<Child>(recordCollection(req)).findOne({ id });
    if (!child && offlineDelete) return res.json({ message: "Child record is already deleted." });
    if (!child || !(await canAccessPurok(user, child.purok_id, child.barangay_id))) return message(res, 404, "Record unavailable.");
    if (offlineDelete && !updatedAt) {
      const created = req.body.offlineCreatedChild;
      if (!created || child.created_by !== user.id || child.name !== created.name || child.birthday !== created.birthday || child.sex !== created.sex || child.parents !== created.parents || child.barangay_id !== created.barangayId || child.purok_id !== created.purokId) return message(res, 409, "This record changed online. Review it before deleting.");
      if (recordCollection(req) === "operation_timbang") {
        const measurements = parseMeasurements(created);
        if (!measurements || (["weight", "height", "muac"] as const).some((field) => (child[field] ?? null) !== measurements[field])) return message(res, 409, "This record's measurements changed online. Review it before deleting.");
      }
    }
    if (updatedAt && child.updated_at !== updatedAt) return message(res, 409, "This record changed after you opened it. Reload and review it before deleting.");
    const filter = updatedAt || offlineDelete ? { id, updated_at: updatedAt || child.updated_at } : { id };
    const result = await db.collection<Child>(recordCollection(req)).deleteOne(filter);
    if (!result.deletedCount) return message(res, 409, "This record changed before it could be deleted. Reload and try again.");
    return res.json({ message: "Child record deleted." });
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
    const [puroks, sitios, children, assignedWorkers, timbangRecords, households] = await Promise.all([
      db.collection<Purok>("puroks").countDocuments({ barangay_id: barangayId }),
      db.collection<Sitio>("sitios").countDocuments({ barangay_id: barangayId }),
      db.collection<Child>("children").countDocuments({ barangay_id: barangayId }),
      db.collection("assignments").countDocuments({ barangay_id: barangayId }),
      db.collection<Child>("operation_timbang").countDocuments({ barangay_id: barangayId }),
      db.collection("household_profiles").countDocuments({ barangayId }),
    ]);
    if (puroks || children || assignedWorkers || timbangRecords || households) {
      const reasons = [
        puroks && `${puroks} Purok${puroks === 1 ? "" : "s"}`,
        sitios && `${sitios} Sitio${sitios === 1 ? "" : "s"}`,
        children && `${children} child record${children === 1 ? "" : "s"}`,
        timbangRecords && `${timbangRecords} Operation Timbang record${timbangRecords === 1 ? "" : "s"}`,
        households && `${households} household profile${households === 1 ? "" : "s"}`,
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

router.post("/api/admin/sitios", requireAdmin, async (req, res, next) => {
  try {
    const barangayId = String(req.body.barangayId ?? "");
    const name = String(req.body.name ?? "").trim();
    if (!validName(name) || !(await canAccessBarangay(res.locals.user as User, barangayId))) return message(res, 400, "Enter a Sitio name and select its barangay.");
    const db = await getDb();
    if (await db.collection<Sitio>("sitios").findOne({ barangay_id: barangayId, name: { $regex: `^${escapeRegExp(name)}$`, $options: "i" } })) return message(res, 409, "That Sitio already exists in this barangay.");
    await db.collection<Sitio>("sitios").insertOne({ id: randomUUID(), name, barangay_id: barangayId, created_at: now() });
    return res.json({ message: "Sitio added." });
  } catch (error) { return next(error); }
});

router.put("/api/admin/sitios/:id", requireAdmin, async (req, res, next) => {
  try {
    const sitioId = String(req.params.id);
    const name = String(req.body.name ?? "").trim();
    if (!validName(name)) return message(res, 400, "Enter a Sitio name under 100 characters.");
    const db = await getDb();
    const current = await db.collection<Sitio>("sitios").findOne({ id: sitioId });
    if (!current) return message(res, 404, "Sitio unavailable.");
    const duplicate = await db.collection<Sitio>("sitios").findOne({ id: { $ne: sitioId }, barangay_id: current.barangay_id, name: { $regex: `^${escapeRegExp(name)}$`, $options: "i" } });
    if (duplicate) return message(res, 409, "That Sitio already exists in this barangay.");
    await db.collection<Sitio>("sitios").updateOne({ id: sitioId }, { $set: { name } });
    return res.json({ message: "Sitio updated." });
  } catch (error) { return next(error); }
});

router.delete("/api/admin/sitios/:id", requireAdmin, async (req, res, next) => {
  try {
    const db = await getDb();
    const sitio = await db.collection<Sitio>("sitios").findOne({ id: req.params.id });
    if (!sitio) return message(res, 404, "Sitio unavailable.");
    if (await db.collection("household_profiles").countDocuments({ sitioId: sitio.id })) return message(res, 409, "This Sitio is used by household profiles. Reassign those households first.");
    await db.collection<Sitio>("sitios").deleteOne({ id: sitio.id });
    return res.json({ message: `Sitio ${sitio.name} deleted.` });
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
    const [children, assignedWorkers, timbangRecords, households] = await Promise.all([
      db.collection<Child>("children").countDocuments({ purok_id: purok.id }),
      db.collection("purok_assignments").countDocuments({ purok_id: purok.id }),
      db.collection<Child>("operation_timbang").countDocuments({ purok_id: purok.id }),
      db.collection("household_profiles").countDocuments({ purokId: purok.id }),
    ]);
    if (children || assignedWorkers || timbangRecords || households) {
      const reasons = [
        children && `${children} child record${children === 1 ? "" : "s"}`,
        timbangRecords && `${timbangRecords} Operation Timbang record${timbangRecords === 1 ? "" : "s"}`,
        households && `${households} household profile${households === 1 ? "" : "s"}`,
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
    const format = req.query.format ?? "xlsx";
    if (format !== "xlsx" && format !== "pdf") return message(res, 400, "Choose Excel or PDF format.");
    if (req.query.program && req.query.program !== "timbang") return message(res, 400, "Choose a valid report.");
    const program = req.query.program === "timbang" ? "timbang" : "deworming";
    const user = res.locals.user as User;
    if (user.must_change_password) return message(res, 403, "Change your password before exporting.");
    const db = await getDb();
    const requestedBarangay = req.query.barangay ? String(req.query.barangay) : "";
    const requestedPurok = req.query.purok ? String(req.query.purok) : "";
    const requestedSitio = req.query.sitio ? String(req.query.sitio) : "";
    if (!requestedBarangay || !requestedPurok || !requestedSitio) return message(res, 400, "Choose a barangay, Sitio, and Purok before exporting.");
    if (!(await canAccessBarangay(user, requestedBarangay))) return message(res, 403, "This barangay is not assigned to your account.");
    if (!(await canAccessPurok(user, requestedPurok, requestedBarangay))) return message(res, 403, "This Purok is not assigned under the selected barangay.");
    const sitio = await db.collection<Sitio>("sitios").findOne({ id: requestedSitio, barangay_id: requestedBarangay });
    if (!sitio) return message(res, 400, "Choose a valid Sitio under the selected barangay.");
    const query: Record<string, unknown> = {};
    query.barangay_id = requestedBarangay;
    query.purok_id = requestedPurok;
    const q = String(req.query.q ?? "").trim().slice(0, 80);
    if (q) query.$or = [{ name: { $regex: escapeRegExp(q), $options: "i" } }, { parents: { $regex: escapeRegExp(q), $options: "i" } }];
    const today = todayInManila();
    const excludeAgeExtremes = String(req.query.excludeAgeExtremes ?? "") === "true";
    const matchedChildren = await db.collection<Child>(program === "timbang" ? "operation_timbang" : "children").find(query).collation({ locale: "en", strength: 2 }).sort({ name: 1, birthday: 1, id: 1 }).toArray();
    const children = excludeAgeExtremes
      ? matchedChildren.filter((child) => {
        const months = ageInMonths(child.birthday, today);
        return program === "timbang" ? months >= 0 && months <= 72 : months >= 6 && months < 60;
      })
      : matchedChildren;
    const [barangay, puroks, assignedWorkers] = await Promise.all([
      db.collection<Barangay>("barangays").findOne({ id: requestedBarangay }),
      db.collection<Purok>("puroks").find({ id: { $in: [...new Set(children.map((c) => c.purok_id))] } }).toArray(),
      db.collection("purok_assignments").find({ purok_id: requestedPurok }).toArray(),
    ]);
    const purokName = new Map(puroks.map((item) => [item.id, item.name]));
    const purok = await db.collection<Purok>("puroks").findOne({ id: requestedPurok, barangay_id: requestedBarangay });
    const workers = await db.collection<User>("users").find({ id: { $in: assignedWorkers.map((item) => String(item.user_id)) }, role: "bhw", is_active: 1 }).toArray();
    const bhwName = workers.map((worker) => worker.display_name).join(", ") || (user.role === "bhw" ? user.display_name : "Unassigned");
    const rows = children.map((child, index) => {
      const common = [`${index + 1}.`, child.name, excelDateSerial(child.birthday), purokName.get(child.purok_id) ?? "", ageInMonths(child.birthday, today)];
      return program === "timbang" ? [...common, child.weight ?? "", child.height ?? "", child.muac ?? "", child.parents, child.sex] : [...common, child.sex, "", "", "", "", child.parents];
    });
    const heading = { barangay: barangay?.name ?? "", sitio: sitio.name, purok: purok?.name ?? "", bhw: bhwName, year: today.slice(0, 4) };
    const file = Buffer.from(format === "pdf" ? await makePrintReport(heading, rows, program) : makeWorkbook(heading, rows, program));
    res.setHeader("Content-Type", format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${program === "timbang" ? "operation-timbang" : "vitamin-a-deworming"}-${today}.${format}"`);
    res.setHeader("Content-Length", String(file.length));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    return res.end(file);
  } catch (error) { return next(error); }
});

function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function excelDateSerial(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000) + 25_569;
}

export const app = express();
app.disable("x-powered-by");
app.use(responseSecurity);
app.use(browserRequestSecurity);
app.use(express.json({ limit: "32kb" }));
app.use(validateJsonRequest);
app.use(router);
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const type = error && typeof error === "object" && "type" in error ? error.type : null;
  if (type === "entity.too.large") return message(res, 413, "The request is too large.");
  if (type === "entity.parse.failed") return message(res, 400, "Invalid JSON request.");
  if (error && typeof error === "object" && "code" in error && error.code === 11000) return message(res, 409, "That record already exists. Reload before trying again.");
  // Driver errors can include raw queries, names, and connection details.
  console.error("API request failed", error instanceof Error ? error.name : "UnknownError");
  return message(res, 500, "The server could not complete this request.");
});
