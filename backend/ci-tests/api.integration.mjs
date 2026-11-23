import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { strFromU8, unzipSync } from "fflate";
import { PDFDocument } from "pdf-lib";

let server;
let database;
let closeDb;

function birthdayMonthsAgo(monthsAgo) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const getPart = (type) => Number(parts.find((part) => part.type === type)?.value);
  const todayYear = getPart("year");
  const todayMonth = getPart("month");
  const todayDay = getPart("day");
  const monthIndex = todayYear * 12 + todayMonth - 1 - monthsAgo;
  const year = Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const day = Math.min(todayDay, new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (database) await database.dropDatabase();
  if (closeDb) await closeDb();
});

test("authenticated worker CRUD, assignment access, and filtered Excel export", {
  skip: !process.env.MONGODB_URI && "Set MONGODB_URI to run the API integration test.",
}, async () => {
  process.env.MONGODB_DATABASE = `bhw_test_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
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

  let workerLogin = await login("integration.worker", "IntegrationWorker!2026");
  assert.equal((await request("/api/auth/me", { cookie: workerLogin.cookie })).status, 200);
  for (const path of ["/api/children", "/api/barangays", "/api/export/xlsx"]) {
    assert.equal((await request(path, { cookie: workerLogin.cookie })).status, 403, "temporary passwords cannot be used to access any registry through the API");
  }
  const oldCookie = workerLogin.cookie;
  const changePassword = await request("/api/auth/password", { method: "POST", cookie: oldCookie, body: { current: "IntegrationWorker!2026", next: "ChangedWorker!2026", confirm: "ChangedWorker!2026" } });
  assert.equal(changePassword.status, 200);
  assert.equal((await request("/api/auth/me", { cookie: oldCookie })).status, 401, "password changes invalidate previous sessions");
  workerLogin = await login("integration.worker", "ChangedWorker!2026");
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
  const member = { id: randomUUID(), surname: "Sample", firstName: "Member", middleName: "", relationship: "Head", sex: "F", birthday: "2020-02-29", heightCm: "", weightKg: "", birthPlace: "", classifications: ["", "", "", ""], religion: "", civilStatus: "", education: "", nipStatus: "", covidStatus: "", profileRemarks: "", philhealthId: "", membershipType: "", nutritionStatus: "", sexuallyActive: "", lastMenstrualPeriod: "", familyPlanningMethod: "", cancer: "", mentalHealth: "", hypertension: "", diabetes: "", tbDots: "", healthRemarks: "" };
  const householdInput = { barangayId: barangay.id, purokId: purok.id, sitioId: sitio.id, householdNumber: "Test Unit 1", respondent: { surname: "Sample", firstName: "Respondent", middleName: "" }, respondentRelationship: "Head", visits: ["2026-01-10", "", "", ""], nhts: "non-nhts", indigenous: "non-ip", tribe: "", headPhilhealth: "", headPhilhealthId: "", headPhilhealthCategory: "", income: "C", renter: "no", renterMonths: "", waterSource: "level-3", waterSourceOther: "", toiletType: "A", wasteMethod: "D", blindDrainage: "no", hazards: [], hazardOther: "", interviewedBy: "Integration Worker", reviewedBy: "", encodedBy: "", dateEncoded: "", members: [member] };
  assert.equal((await request("/api/households", { cookie: workerLogin.cookie })).status, 200);
  const outsideHousehold = await request("/api/households", { method: "POST", cookie: workerLogin.cookie, body: { ...householdInput, purokId: otherPurok.id } });
  assert.equal(outsideHousehold.status, 403, "households must stay within the worker's assigned Purok");
  const createdHousehold = await request("/api/households", { method: "POST", cookie: workerLogin.cookie, body: householdInput });
  assert.equal(createdHousehold.status, 200);
  const household = (await createdHousehold.json()).household;
  assert.equal(household.householdNumber, "Test Unit 1");
  const listedHouseholds = (await (await request("/api/households", { cookie: workerLogin.cookie })).json()).households;
  assert.equal(listedHouseholds.find((item) => item.id === household.id)?.sitio_name, "Springwoods");
  const householdPdf = await request(`/api/households/${household.id}/pdf`, { cookie: workerLogin.cookie });
  assert.equal(householdPdf.status, 200);
  const printed = await PDFDocument.load(await householdPdf.arrayBuffer());
  assert.equal(printed.getPageCount(), 2);
  const staleHousehold = await request("/api/households", { method: "POST", cookie: workerLogin.cookie, body: { ...householdInput, id: household.id, expectedUpdatedAt: "old-version" } });
  assert.equal(staleHousehold.status, 409);
  const updatedHousehold = await request("/api/households", { method: "POST", cookie: workerLogin.cookie, body: { ...householdInput, id: household.id, householdNumber: "Test Unit 2", expectedUpdatedAt: household.updated_at } });
  assert.equal(updatedHousehold.status, 200);
  const changedHousehold = (await updatedHousehold.json()).household;
  assert.equal((await request(`/api/admin/sitios/${sitio.id}`, { method: "DELETE", cookie: admin.cookie, body: {} })).status, 409);
  assert.equal((await request(`/api/households/${household.id}`, { method: "DELETE", cookie: workerLogin.cookie, body: { expectedUpdatedAt: changedHousehold.updated_at } })).status, 200);
  assert.equal((await request(`/api/households/${household.id}`, { cookie: workerLogin.cookie })).status, 404);
  for (const field of ["id", "barangayId", "purokId"]) {
    const injected = await request("/api/children", { method: "POST", cookie: workerLogin.cookie, body: { name: "Injected", birthday: created.birthday, sex: "M", parents: "Guardian", barangayId: barangay.id, purokId: purok.id, [field]: { $ne: null } } });
    assert.equal(injected.status, 400, "query operators must never reach record lookups");
  }

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

  // A read receipt belongs to the account, survives a fresh login, and cannot
  // be written for another worker's assigned records or arbitrary milestones.
  const noticeDate = birthdayMonthsAgo(0);
  const receiptChild = { ...updated, id: randomUUID(), birthday: birthdayMonthsAgo(12) };
  const hiddenReceiptChild = { ...receiptChild, id: randomUUID(), purok_id: otherPurok.id };
  await database.collection("children").insertMany([receiptChild, hiddenReceiptChild]);
  try {
    const receiptId = `${receiptChild.id}:${noticeDate}`;
    const hiddenReceiptId = `${hiddenReceiptChild.id}:${noticeDate}`;
    assert.equal((await request("/api/notifications/age/read")).status, 401);
    const readResponse = await request("/api/notifications/age/read", { method: "PUT", cookie: workerLogin.cookie, body: { ids: [receiptId, hiddenReceiptId, `missing-child:${noticeDate}`], userId: "admin" } });
    assert.equal(readResponse.status, 200);
    assert.deepEqual(await readResponse.json(), { userId: worker.id, readIds: [receiptId] });
    const repeatRead = await request("/api/notifications/age/read", { method: "PUT", cookie: workerLogin.cookie, body: { ids: [receiptId, receiptId] } });
    assert.equal(repeatRead.status, 200);
    assert.equal(await database.collection("notification_reads").countDocuments({ user_id: worker.id, notice_id: receiptId }), 1);
    const adminReceipts = await (await request("/api/notifications/age/read", { cookie: admin.cookie })).json();
    assert.deepEqual(adminReceipts.readIds, []);
    assert.equal((await request("/api/notifications/age/read", { method: "PUT", cookie: workerLogin.cookie, body: { ids: [{ $ne: null }] } })).status, 400);
    await request("/api/auth/logout", { method: "POST", cookie: workerLogin.cookie, body: {} });
    workerLogin = await login("integration.worker", "ChangedWorker!2026");
    const afterLogin = await (await request("/api/notifications/age/read", { cookie: workerLogin.cookie })).json();
    assert.deepEqual(afterLogin.readIds, [receiptId], "read status survives logout and a new session");
  } finally {
    await database.collection("children").deleteMany({ id: { $in: [receiptChild.id, hiddenReceiptChild.id] } });
  }

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

  // Different birthdays and mixed capitalization must still export names A–Z.
  for (const [collection, programQuery] of [["children", ""], ["operation_timbang", "&program=timbang"]]) {
    const orderFixtures = [
      { id: randomUUID(), name: "Z Older Child", birthday: "2020-01-15" },
      { id: randomUUID(), name: "A Younger Child", birthday: "2025-12-20" },
      { id: randomUUID(), name: "B Same Birthday Child", birthday: "2020-01-15" },
      { id: randomUUID(), name: "c Lowercase Child", birthday: "2024-01-15" },
    ].map((child) => ({ ...child, sex: "F", parents: "Ordering Guardian", barangay_id: barangay.id, purok_id: purok.id, created_by: worker.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }));
    await database.collection(collection).insertMany(orderFixtures);
    try {
      const ordered = await request(`/api/export/xlsx?barangay=${barangay.id}&purok=${purok.id}&sitio=${sitio.id}${programQuery}`, { cookie: admin.cookie });
      assert.equal(ordered.status, 200);
      const orderSheet = strFromU8(unzipSync(new Uint8Array(await ordered.arrayBuffer()))["xl/worksheets/sheet1.xml"]);
      assert.ok(orderSheet.indexOf("A Younger Child") < orderSheet.indexOf("B Same Birthday Child"), "exports sort by child name before birthday");
      assert.ok(orderSheet.indexOf("B Same Birthday Child") < orderSheet.indexOf("c Lowercase Child"), "lowercase names belong in alphabetical order");
      assert.ok(orderSheet.indexOf("c Lowercase Child") < orderSheet.indexOf("Z Older Child"), "name order is case insensitive");
      assert.match(orderSheet, /<c r="A7" t="inlineStr" s="6"><is><t xml:space="preserve">1\.<\/t>/);
    } finally {
      await database.collection(collection).deleteMany({ id: { $in: orderFixtures.map((child) => child.id) } });
    }

    const ageFixtures = (collection === "operation_timbang" ? [0, 5, 60, 72, 73, 74] : [5, 6, 59, 60]).map((months) => ({
      id: randomUUID(),
      name: `Age Boundary ${months}`,
      birthday: birthdayMonthsAgo(months),
      sex: "F",
      parents: "Boundary Guardian",
      barangay_id: barangay.id,
      purok_id: purok.id,
      created_by: worker.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    await database.collection(collection).insertMany(ageFixtures);
    try {
      const rangeExport = await request(`/api/export/xlsx?barangay=${barangay.id}&purok=${purok.id}&sitio=${sitio.id}&excludeAgeExtremes=true${programQuery}`, { cookie: admin.cookie });
      assert.equal(rangeExport.status, 200);
      const rangeSheet = strFromU8(unzipSync(new Uint8Array(await rangeExport.arrayBuffer()))["xl/worksheets/sheet1.xml"]);
      if (collection === "operation_timbang") {
        for (const months of [0, 5, 60, 72]) assert.match(rangeSheet, new RegExp(`Age Boundary ${months}(?:<|&)`), `${months} months should remain in the Operation Timbang export`);
        for (const months of [73, 74]) assert.doesNotMatch(rangeSheet, new RegExp(`Age Boundary ${months}(?:<|&)`), `${months} months should be excluded from the Operation Timbang export`);
        const printRange = await request(`/api/export/xlsx?format=pdf&barangay=${barangay.id}&purok=${purok.id}&sitio=${sitio.id}&excludeAgeExtremes=true&program=timbang`, { cookie: admin.cookie });
        assert.equal(printRange.status, 200);
        assert.match(printRange.headers.get("content-type") ?? "", /application\/pdf/);
        assert.equal(Buffer.from(await printRange.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
      } else {
        assert.match(rangeSheet, /Age Boundary 6/, "the 6-month lower boundary should remain in the export");
        assert.match(rangeSheet, /Age Boundary 59/, "the 59-month upper boundary should remain in the export");
        assert.doesNotMatch(rangeSheet, /Age Boundary 5(?:<|&)/, "children aged 0 through 5 months should be excluded");
        assert.doesNotMatch(rangeSheet, /Age Boundary 60(?:<|&)/, "children aged 60 months and older should be excluded");
      }
    } finally {
      await database.collection(collection).deleteMany({ id: { $in: ageFixtures.map((child) => child.id) } });
    }
  }

  const printResponse = await request(`/api/export/xlsx?format=pdf&barangay=${encodeURIComponent(barangay.id)}&purok=${encodeURIComponent(purok.id)}&sitio=${encodeURIComponent(sitio.id)}`, { cookie: admin.cookie });
  assert.equal(printResponse.status, 200);
  assert.match(printResponse.headers.get("content-type") ?? "", /application\/pdf/);
  assert.match(printResponse.headers.get("content-disposition") ?? "", /\.pdf/);
  assert.equal(Buffer.from(await printResponse.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");

  const timbangBody = { id: created.id, expectedUpdatedAt: null, offlineUserId: worker.id, name: "Timbang Child", birthday: created.birthday, sex: "M", parents: "Timbang Guardian", barangayId: barangay.id, purokId: purok.id, weight: "12.25", height: "81", muac: "16.5" };
  const invalidMeasurement = await request("/api/operation-timbang", { method: "POST", cookie: workerLogin.cookie, body: { ...timbangBody, weight: -1 } });
  assert.equal(invalidMeasurement.status, 400);
  const outsideTimbang = await request("/api/operation-timbang", { method: "POST", cookie: workerLogin.cookie, body: { ...timbangBody, purokId: otherPurok.id } });
  assert.equal(outsideTimbang.status, 400);
  const createTimbang = await request("/api/operation-timbang", { method: "POST", cookie: workerLogin.cookie, body: timbangBody });
  assert.equal(createTimbang.status, 200);
  const timbang = (await createTimbang.json()).child;
  assert.equal(timbang.weight, 12.25);
  assert.equal(timbang.height, 81);
  assert.equal(timbang.muac, 16.5);
  const replayTimbang = await request("/api/operation-timbang", { method: "POST", cookie: workerLogin.cookie, body: timbangBody });
  assert.equal(replayTimbang.status, 200, "a lost offline response can be replayed without duplicating a measurement record");
  const changedReplay = await request("/api/operation-timbang", { method: "POST", cookie: workerLogin.cookie, body: { ...timbangBody, muac: "18" } });
  assert.equal(changedReplay.status, 409);
  const operationList = await request("/api/operation-timbang", { cookie: workerLogin.cookie });
  assert.deepEqual((await operationList.json()).children.map((item) => item.name), ["Timbang Child"]);
  const dewormingList = await request("/api/children", { cookie: workerLogin.cookie });
  assert.deepEqual((await dewormingList.json()).children.map((item) => item.name), ["Updated Test Child"], "the same record ID in Operation Timbang cannot overwrite the deworming record");
  const activityPath = `/api/admin/users/${encodeURIComponent(worker.id)}/records`;
  assert.equal((await request(activityPath, { cookie: workerLogin.cookie })).status, 403, "workers must not view staff activity");
  assert.equal((await request(`${activityPath}?page=0`, { cookie: admin.cookie })).status, 400);
  assert.equal((await request(`${activityPath}?program=unknown`, { cookie: admin.cookie })).status, 400);
  assert.equal((await request("/api/admin/users/missing/records", { cookie: admin.cookie })).status, 404);
  const activityResponse = await request(activityPath, { cookie: admin.cookie });
  assert.equal(activityResponse.status, 200);
  const activity = await activityResponse.json();
  assert.deepEqual(activity.counts, { deworming: 1, timbang: 1, total: 2 }, "admin-created records must not count toward a worker's additions");
  assert.deepEqual(activity.records.map(({ id, program }) => ({ id, program })), [
    { id: created.id, program: "timbang" },
    { id: created.id, program: "deworming" },
  ], "records from separate registries must remain distinguishable even when they share an ID");
  assert.equal(activity.records[0].barangay_name, barangay.name);
  assert.equal(activity.records[0].purok_name, purok.name);
  const timbangActivity = await (await request(`${activityPath}?program=timbang`, { cookie: admin.cookie })).json();
  assert.deepEqual(timbangActivity.records.map((item) => item.name), ["Timbang Child"]);
  assert.equal(timbangActivity.filteredTotal, 1);
  const timbangQuery = `program=timbang&barangay=${encodeURIComponent(barangay.id)}&purok=${encodeURIComponent(purok.id)}&sitio=${encodeURIComponent(sitio.id)}`;
  const timbangExport = await request(`/api/export/xlsx?${timbangQuery}`, { cookie: admin.cookie });
  assert.equal(timbangExport.status, 200);
  assert.match(timbangExport.headers.get("content-disposition"), /operation-timbang-.*\.xlsx/);
  const timbangSheet = strFromU8(unzipSync(new Uint8Array(await timbangExport.arrayBuffer()))["xl/worksheets/sheet1.xml"]);
  assert.match(timbangSheet, /Timbang Child/);
  assert.doesNotMatch(timbangSheet, /Updated Test Child|Vitamin A|Deworming/);
  assert.match(timbangSheet, /<c r="F7" s="6"><v>12.25<\/v>/);
  const timbangPdf = await request(`/api/export/xlsx?${timbangQuery}&format=pdf`, { cookie: admin.cookie });
  assert.equal(timbangPdf.status, 200);
  assert.match(timbangPdf.headers.get("content-type"), /application\/pdf/);
  const updateTimbang = await request("/api/operation-timbang", { method: "POST", cookie: workerLogin.cookie, body: { ...timbangBody, expectedUpdatedAt: timbang.updated_at, weight: "13.5", muac: "" } });
  assert.equal(updateTimbang.status, 200);
  const editedTimbang = (await updateTimbang.json()).child;
  assert.equal(editedTimbang.weight, 13.5);
  assert.equal(editedTimbang.muac, null);
  const staleTimbang = await request("/api/operation-timbang", { method: "POST", cookie: workerLogin.cookie, body: { ...timbangBody, expectedUpdatedAt: timbang.updated_at } });
  assert.equal(staleTimbang.status, 409);
  const deleteTimbang = await request(`/api/operation-timbang/${created.id}`, { method: "DELETE", cookie: workerLogin.cookie, body: { updatedAt: editedTimbang.updated_at } });
  assert.equal(deleteTimbang.status, 200);
  const afterTimbangDelete = await (await request(activityPath, { cookie: admin.cookie })).json();
  assert.deepEqual(afterTimbangDelete.counts, { deworming: 1, timbang: 0, total: 1 });
  const retainedChild = await request("/api/children", { cookie: workerLogin.cookie });
  assert.deepEqual((await retainedChild.json()).children.map((item) => item.id), [created.id], "deleting from Operation Timbang must preserve the deworming record");

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

  const { consumeLimit } = await import("../src/request-security.ts");
  const parallelLimits = await Promise.all(Array.from({ length: 12 }, () => consumeLimit("test", "parallel", 5, 60_000)));
  assert.equal(parallelLimits.filter((retry) => retry === 0).length, 5, "concurrent requests share an atomic database counter");
  const failures = await Promise.all(Array.from({ length: 5 }, () => request("/api/auth/login", { method: "POST", body: { username: "unknown.worker", password: "InvalidPassword!2026" } })));
  assert.ok(failures.every((response) => [401, 429].includes(response.status)));
  const locked = await request("/api/auth/login", { method: "POST", body: { username: "unknown.worker", password: "InvalidPassword!2026" } });
  assert.equal(locked.status, 429);
  assert.ok(Number(locked.headers.get("retry-after")) > 0);
  const throttleRecord = await database.collection("login_attempts").findOne({ username: "unknown.worker" });
  assert.ok(throttleRecord.expires_at instanceof Date, "failed login records expire automatically");

  assert.equal((await request(`/api/admin/users/${worker.id}/active`, { method: "PUT", cookie: admin.cookie, body: { active: false } })).status, 200);
  assert.equal((await request("/api/auth/me", { cookie: workerLogin.cookie })).status, 401, "deactivated workers lose their server session");
});
