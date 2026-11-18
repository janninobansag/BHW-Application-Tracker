import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { strFromU8, unzipSync } from "fflate";

let server;
let database;
let closeDb;

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (database) await database.dropDatabase();
  if (closeDb) await closeDb();
});

test("authenticated worker CRUD, assignment access, and filtered Excel export", {
  skip: !process.env.MONGODB_URI && "Set MONGODB_URI to run the API integration test.",
}, async () => {
  process.env.MONGODB_DATABASE = `bhw_api_test_${randomUUID().replaceAll("-", "")}`;
  process.env.ADMIN_SETUP_TOKEN = "ci-only-admin-setup-token";
  process.env.SESSION_SECRET = "ci-only-session-secret-for-tests";

  const [{ app }, dbModule] = await Promise.all([
    import("../src/app.ts"),
    import("../src/db.js"),
  ]);
  closeDb = dbModule.closeDb;
  database = await dbModule.getDb();
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const request = (path, { method = "GET", body, cookie } = {}) => fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const login = async (username, password) => {
    const response = await request("/api/auth/login", { method: "POST", body: { username, password } });
    assert.equal(response.status, 200);
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie, "login should set the session cookie");
    return { cookie, payload: await response.json() };
  };

  const noSession = await request("/api/children");
  assert.equal(noSession.status, 401, "private records should require a session");

  const setup = await request("/api/auth/setup-admin", {
    method: "POST",
    body: { setupToken: process.env.ADMIN_SETUP_TOKEN, password: "IntegrationAdmin!2026", confirm: "IntegrationAdmin!2026" },
  });
  assert.equal(setup.status, 200);
  const admin = await login("admin", "IntegrationAdmin!2026");

  const createBarangay = await request("/api/admin/barangays", { method: "POST", cookie: admin.cookie, body: { name: "Integration Tulay" } });
  assert.equal(createBarangay.status, 200);
  const barangay = (await (await request("/api/barangays", { cookie: admin.cookie })).json()).barangays.find((item) => item.name === "Integration Tulay");
  assert.ok(barangay);

  const createPurok = await request("/api/admin/puroks", { method: "POST", cookie: admin.cookie, body: { barangayId: barangay.id, name: "Hermit Crab" } });
  assert.equal(createPurok.status, 200);
  const purok = (await (await request(`/api/puroks?barangay=${encodeURIComponent(barangay.id)}`, { cookie: admin.cookie })).json()).puroks.find((item) => item.name === "Hermit Crab");
  assert.ok(purok);

  const createOtherPurok = await request("/api/admin/puroks", { method: "POST", cookie: admin.cookie, body: { barangayId: barangay.id, name: "Other Purok" } });
  assert.equal(createOtherPurok.status, 200);
  const otherPurok = (await (await request(`/api/puroks?barangay=${encodeURIComponent(barangay.id)}`, { cookie: admin.cookie })).json()).puroks.find((item) => item.name === "Other Purok");
  assert.ok(otherPurok);

  const createSitio = await request("/api/admin/sitios", { method: "POST", cookie: admin.cookie, body: { barangayId: barangay.id, name: "Springwoods" } });
  assert.equal(createSitio.status, 200);
  const sitio = (await (await request(`/api/sitios?barangay=${encodeURIComponent(barangay.id)}`, { cookie: admin.cookie })).json()).sitios.find((item) => item.name === "Springwoods");
  assert.ok(sitio);

  const createWorker = await request("/api/admin/users", {
    method: "POST",
    cookie: admin.cookie,
    body: { username: "integration.worker", displayName: "Integration Worker", temporaryPassword: "IntegrationWorker!2026" },
  });
  assert.equal(createWorker.status, 200);
  const worker = (await (await request("/api/admin/users", { cookie: admin.cookie })).json()).users.find((item) => item.username === "integration.worker");
  assert.ok(worker);
  const assign = await request(`/api/admin/users/${worker.id}/assignments`, {
    method: "PUT",
    cookie: admin.cookie,
    body: { barangayIds: [barangay.id], purokIds: [purok.id] },
  });
  assert.equal(assign.status, 200);

  const workerLogin = await login("integration.worker", "IntegrationWorker!2026");
  const adminOnly = await request("/api/admin/users", { cookie: workerLogin.cookie });
  assert.equal(adminOnly.status, 403, "BHWs must not access admin account management");

  const unassignedPurokChild = await request("/api/children", {
    method: "POST",
    cookie: workerLogin.cookie,
    body: { name: "Outside Assignment", birthday: "2024-06-11", sex: "M", parents: "Test Guardian", barangayId: barangay.id, purokId: otherPurok.id },
  });
  assert.equal(unassignedPurokChild.status, 400, "BHWs must not create records outside their Purok assignment");

  const createChild = await request("/api/children", {
    method: "POST",
    cookie: workerLogin.cookie,
    body: { name: "Test Child", birthday: "2024-06-11", sex: "M", parents: "Test Guardian", barangayId: barangay.id, purokId: purok.id },
  });
  assert.equal(createChild.status, 200);
  const created = (await createChild.json()).child;
  assert.equal(created.name, "Test Child");

  const listed = await request(`/api/children?barangay=${encodeURIComponent(barangay.id)}&purok=${encodeURIComponent(purok.id)}&q=Test%20Child`, { cookie: workerLogin.cookie });
  assert.equal(listed.status, 200);
  assert.deepEqual((await listed.json()).children.map((item) => item.id), [created.id]);

  const updateChild = await request("/api/children", {
    method: "POST",
    cookie: workerLogin.cookie,
    body: { id: created.id, updatedAt: created.updated_at, name: "Updated Test Child", birthday: created.birthday, sex: "F", parents: "Updated Guardian", barangayId: barangay.id, purokId: purok.id },
  });
  assert.equal(updateChild.status, 200);
  const updated = (await updateChild.json()).child;
  assert.equal(updated.name, "Updated Test Child");

  const otherPurokChild = await request("/api/children", {
    method: "POST",
    cookie: admin.cookie,
    body: { name: "Other Purok Child", birthday: "2023-06-11", sex: "M", parents: "Other Guardian", barangayId: barangay.id, purokId: otherPurok.id },
  });
  assert.equal(otherPurokChild.status, 200);

  const staleUpdate = await request("/api/children", {
    method: "POST",
    cookie: workerLogin.cookie,
    body: { id: created.id, updatedAt: created.updated_at, name: "Stale Update", birthday: created.birthday, sex: "F", parents: "Updated Guardian", barangayId: barangay.id, purokId: purok.id },
  });
  assert.equal(staleUpdate.status, 409, "stale edits should not overwrite the latest record");

  const exportResponse = await request(`/api/export/xlsx?barangay=${encodeURIComponent(barangay.id)}&purok=${encodeURIComponent(purok.id)}&sitio=${encodeURIComponent(sitio.id)}`, { cookie: admin.cookie });
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-type") ?? "", /spreadsheetml\.sheet/);
  assert.match(exportResponse.headers.get("content-disposition") ?? "", /\.xlsx/);
  const exportedFile = new Uint8Array(await exportResponse.arrayBuffer());
  const sheet = strFromU8(unzipSync(exportedFile)["xl/worksheets/sheet1.xml"]);
  assert.match(sheet, /Barangay: Integration Tulay/);
  assert.match(sheet, /Sitio\/Purok: Springwoods \/ Hermit Crab/);
  assert.match(sheet, /Updated Test Child/);
  assert.doesNotMatch(sheet, /Other Purok Child/, "export should include only the selected Purok");
  assert.match(sheet, /<f>COUNTIF\(F7:F7,&quot;F&quot;\)<\/f><v>1<\/v>/);
  assert.match(sheet, /<f>COUNTA\(B7:B7\)<\/f><v>1<\/v>/);

  const staleOfflineDelete = await request(`/api/children/${encodeURIComponent(created.id)}`, {
    method: "DELETE", cookie: workerLogin.cookie,
    body: { updatedAt: "older-offline-version", offlineUserId: worker.id },
  });
  assert.equal(staleOfflineDelete.status, 409, "offline deletion must not erase a newer online record");
  const wrongOfflineAccount = await request(`/api/children/${encodeURIComponent(created.id)}`, {
    method: "DELETE", cookie: workerLogin.cookie,
    body: { updatedAt: updated.updated_at, offlineUserId: "another-worker" },
  });
  assert.equal(wrongOfflineAccount.status, 403);
  const deleteChild = await request(`/api/children/${encodeURIComponent(created.id)}`, {
    method: "DELETE",
    cookie: workerLogin.cookie,
    body: { updatedAt: updated.updated_at },
  });
  assert.equal(deleteChild.status, 200);
  const repeatedOfflineDelete = await request(`/api/children/${encodeURIComponent(created.id)}`, {
    method: "DELETE", cookie: workerLogin.cookie,
    body: { updatedAt: updated.updated_at, offlineUserId: worker.id },
  });
  assert.equal(repeatedOfflineDelete.status, 200, "replaying a deletion after a lost response must succeed");
  const afterDelete = await request(`/api/children?q=Updated%20Test%20Child`, { cookie: workerLogin.cookie });
  assert.deepEqual((await afterDelete.json()).children, []);
});
