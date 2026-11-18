import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { prepareWorker, readWorkerContents, queueWorkerChild, queueWorkerDelete, syncWorkerChanges, closeWorkerAccess } from "../public/worker-offline-store.js";

const values = new Map();
Object.defineProperty(globalThis, "localStorage", { value: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }, configurable: true });
let locked = Promise.resolve();
Object.defineProperty(navigator, "locks", { value: { request: (_name, operation) => {
  const next = locked.then(operation);
  locked = next.catch(() => {});
  return next;
} }, configurable: true });
Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
const child = { name: "Sample child", birthday: "2024-01-01", sex: "F", parents: "Sample parent", barangayId: "b", purokId: "p" };
const snapshot = (id) => ({ user: { id, username: id, display_name: "Worker" }, children: [], barangays: [{ id: "b", name: "Tulay" }], puroks: [{ id: "p", barangay_id: "b", name: "Hermit Crab" }], savedAt: new Date().toISOString() });
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

test("automatic worker storage and reconnect sync preserve records", async (t) => {
  await t.test("preparing a fresh snapshot preserves the durable queue and simultaneous saves", async () => {
    await prepareWorker(snapshot("preserve"));
    await Promise.all([queueWorkerChild(child, "a"), queueWorkerChild({ ...child, name: "Another child" }, "b")]);
    await prepareWorker(snapshot("preserve"));
    assert.deepEqual((await readWorkerContents()).pending.map((item) => item.id).sort(), ["a", "b"]);
    // A new module instance represents reopening the application after a reload.
    const reopened = await import("../public/worker-offline-store.js?reopened");
    assert.equal((await reopened.readWorkerContents()).pending.length, 2);
  });
  await t.test("the device stores encrypted data with a non-exportable browser key", async () => {
    const request = indexedDB.open("bhw-worker-offline", 1);
    const db = await new Promise((resolve) => { request.onsuccess = () => resolve(request.result); });
    const recordRequest = db.transaction("accounts", "readonly").objectStore("accounts").get("preserve");
    const record = await new Promise((resolve) => { recordRequest.onsuccess = () => resolve(recordRequest.result); });
    assert.equal(record.key.extractable, false);
    assert.equal(record.contents, undefined);
    assert.ok(record.ciphertext instanceof ArrayBuffer);
    assert.ok(!new TextDecoder().decode(record.ciphertext).includes(child.name));
    db.close();
  });
  await t.test("sign-out closes access and signing in to another worker isolates queues", async () => {
    closeWorkerAccess();
    assert.equal(await readWorkerContents(), null);
    await prepareWorker(snapshot("other"));
    assert.equal((await readWorkerContents()).pending.length, 0);
    await prepareWorker(snapshot("preserve"));
    assert.equal((await readWorkerContents()).pending.length, 2);
  });
  await t.test("a changed online account cannot send another worker's queued records", async () => {
    globalThis.fetch = async (url) => {
      assert.equal(url, "/api/backend/auth/me");
      return json({ user: { id: "other", role: "bhw" } });
    };
    await assert.rejects(syncWorkerChanges(), /same worker account/);
    assert.equal((await readWorkerContents()).pending.length, 2);
  });
  await t.test("a dropped response retains the same record ID for a safe retry", async () => {
    await prepareWorker(snapshot("replay"));
    await queueWorkerChild(child, "stable-id");
    const server = new Map();
    let dropResponse = true;
    globalThis.fetch = async (url, init) => {
      if (url.endsWith("auth/me")) return json({ user: { id: "replay", role: "bhw" } });
      if (init.method === "POST") {
        const data = JSON.parse(init.body);
        assert.equal(data.offlineUserId, "replay");
        server.set(data.id, { ...data, updated_at: "version-1" });
        if (dropResponse) { dropResponse = false; throw new TypeError("Connection lost after server saved"); }
        return json({ child: server.get(data.id) });
      }
      if (url.endsWith("children")) return json({ children: [...server.values()] });
      if (url.endsWith("barangays")) return json({ barangays: snapshot("replay").barangays });
      return json({ puroks: snapshot("replay").puroks });
    };
    await assert.rejects(syncWorkerChanges(), /Connection lost/);
    assert.equal((await readWorkerContents()).pending[0].id, "stable-id");
    await syncWorkerChanges();
    assert.equal(server.size, 1);
    assert.equal((await readWorkerContents()).pending.length, 0);
  });
  await t.test("online conflicts stay queued for explicit review", async () => {
    await prepareWorker(snapshot("conflict"));
    await queueWorkerChild(child, "changed");
    globalThis.fetch = async (url, init) => {
      if (url.endsWith("auth/me")) return json({ user: { id: "conflict", role: "bhw" } });
      if (init.method === "POST") return json({ message: "Changed online" }, 409);
      if (url.endsWith("children")) return json({ children: [{ id: "changed", name: "Online version", updated_at: "new" }] });
      if (url.endsWith("barangays")) return json({ barangays: snapshot("conflict").barangays });
      return json({ puroks: snapshot("conflict").puroks });
    };
    await syncWorkerChanges();
    const contents = await readWorkerContents();
    assert.equal(contents.pending.length, 1);
    assert.equal(contents.conflicts[0].remote.name, "Online version");
  });
  await t.test("a page that unmounted during preparation cannot reopen signed-out access", async () => {
    closeWorkerAccess();
    await prepareWorker(snapshot("gone"), () => false);
    assert.equal(await readWorkerContents(), null);
  });
  await t.test("sign-out while preparation is running prevents later automatic reopening", async () => {
    const preparation = prepareWorker(snapshot("signout-race"));
    closeWorkerAccess();
    await preparation;
    assert.equal(await readWorkerContents(), null);
  });
  await t.test("an edit keeps the version opened by the worker even after a background refresh", async () => {
    const updated = snapshot("editing");
    updated.children = [{ id: "edited-id", ...child, updated_at: "newer-online-version" }];
    await prepareWorker(updated);
    await queueWorkerChild(child, "edited-id", "version-when-editor-opened");
    assert.equal((await readWorkerContents()).pending[0].expectedUpdatedAt, "version-when-editor-opened");
  });
  await t.test("deleting a queued create retains an idempotent delete for a possibly lost server response", async () => {
    await prepareWorker(snapshot("delete-new"));
    await queueWorkerChild(child, "new-local-id");
    await queueWorkerDelete("new-local-id");
    const pending = (await readWorkerContents()).pending;
    assert.equal(pending.length, 1);
    assert.equal(pending[0].kind, "delete");
    assert.equal(pending[0].expectedUpdatedAt, null);
    globalThis.fetch = async (url, init) => {
      if (url.endsWith("auth/me")) return json({ user: { id: "delete-new", role: "bhw" } });
      if (init.method === "DELETE") {
        assert.equal(url, "/api/backend/children/new-local-id");
        assert.deepEqual(JSON.parse(init.body).offlineCreatedChild, child);
        return json({ message: "Already deleted" });
      }
      if (url.endsWith("children")) return json({ children: [] });
      if (url.endsWith("barangays")) return json({ barangays: snapshot("delete-new").barangays });
      return json({ puroks: snapshot("delete-new").puroks });
    };
    await syncWorkerChanges();
    assert.equal((await readWorkerContents()).pending.length, 0);
  });
  await t.test("a delete response lost after commit retries without restoring or duplicating the record", async () => {
    const initial = snapshot("delete-retry");
    initial.children = [{ id: "remove-id", ...child, updated_at: "original-version" }];
    await prepareWorker(initial);
    await queueWorkerDelete("remove-id", "original-version");
    let removed = false;
    globalThis.fetch = async (url, init) => {
      if (url.endsWith("auth/me")) return json({ user: { id: "delete-retry", role: "bhw" } });
      if (init.method === "DELETE") {
        assert.equal(JSON.parse(init.body).updatedAt, "original-version");
        if (!removed) { removed = true; throw new TypeError("Lost delete response"); }
        return json({ message: "Already deleted" });
      }
      if (url.endsWith("children")) return json({ children: [] });
      if (url.endsWith("barangays")) return json({ barangays: initial.barangays });
      return json({ puroks: initial.puroks });
    };
    await assert.rejects(syncWorkerChanges(), /Lost delete response/);
    assert.equal((await readWorkerContents()).pending[0].kind, "delete");
    await syncWorkerChanges();
    assert.equal((await readWorkerContents()).pending.length, 0);
    assert.equal((await readWorkerContents()).snapshot.children.length, 0);
  });
});
