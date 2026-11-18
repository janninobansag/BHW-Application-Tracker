// Shared by the online worker page and the cached offline workspace.
const DATABASE = "bhw-worker-offline";
const ACTIVE = "bhw-active-worker";
const ACCESS_VERSION = "bhw-worker-access-version";

function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("accounts", { keyPath: "userId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function stored(userId, replacement) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("accounts", replacement ? "readwrite" : "readonly");
    const store = transaction.objectStore("accounts");
    const request = replacement ? store.put(replacement) : store.get(userId);
    let result;
    request.onsuccess = () => { result = request.result; };
    transaction.oncomplete = () => { db.close(); resolve(result); };
    transaction.onerror = transaction.onabort = () => { db.close(); reject(transaction.error || new Error("Could not save offline records.")); };
  });
}

export function activeWorkerId() { return localStorage.getItem(ACTIVE); }
export function closeWorkerAccess() {
  try {
    localStorage.removeItem(ACTIVE);
    localStorage.setItem(ACCESS_VERSION, crypto.randomUUID());
  } catch { /* Normal online sign-out must work when browser storage is blocked. */ }
}

function exclusive(operation) {
  if (!navigator.locks) throw new Error("This browser needs an update to support automatic offline records.");
  return navigator.locks.request("bhw-worker-offline", operation);
}

async function read(userId) {
  const record = await stored(userId);
  if (!record) return null;
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: record.iv, additionalData: new TextEncoder().encode(userId) }, record.key, record.ciphertext);
  return { record, contents: JSON.parse(new TextDecoder().decode(plaintext)) };
}

async function persist(record, contents) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(record.userId) }, record.key, new TextEncoder().encode(JSON.stringify(contents)));
  await stored(record.userId, { ...record, iv, ciphertext });
}

export async function prepareWorker(snapshot, isCurrent = () => true) {
  const accessVersion = localStorage.getItem(ACCESS_VERSION);
  return exclusive(async () => {
    const userId = snapshot.user.id;
    const previous = await read(userId);
    const record = previous?.record || { userId, key: await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]) };
    // Never replace a pending queue when a fresh server snapshot arrives.
    const contents = { snapshot, pending: previous?.contents.pending || [], conflicts: previous?.contents.conflicts || [], ...(previous?.contents.draft ? { draft: previous.contents.draft } : {}) };
    await persist(record, contents);
    if (isCurrent() && localStorage.getItem(ACCESS_VERSION) === accessVersion) localStorage.setItem(ACTIVE, userId);
    return contents;
  });
}

export async function readWorkerContents() {
  const userId = activeWorkerId();
  return userId ? (await read(userId))?.contents || null : null;
}

export async function changeWorkerContents(operation) {
  return exclusive(async () => {
    const userId = activeWorkerId();
    const current = userId && await read(userId);
    if (!current) throw new Error("Sign in online once on this device to prepare your assigned records.");
    await operation(current.contents);
    if (activeWorkerId() !== userId) throw new Error("The signed-in account changed. Reopen your records.");
    await persist(current.record, current.contents);
    return current.contents;
  });
}

export async function queueWorkerChild(child, id = crypto.randomUUID(), expectedUpdatedAt) {
  return changeWorkerContents((contents) => {
    const original = contents.snapshot.children.find((item) => item.id === id);
    const queued = contents.pending.find((item) => item.id === id);
    if (!contents.snapshot.puroks.some((item) => item.id === child.purokId && item.barangay_id === child.barangayId)) throw new Error("Choose a Purok assigned to you.");
    const next = { id, kind: queued?.kind || (original ? "update" : "create"), child,
      expectedUpdatedAt: queued ? queued.expectedUpdatedAt : expectedUpdatedAt ?? original?.updated_at ?? null,
      queuedAt: queued?.queuedAt || new Date().toISOString() };
    contents.pending = [...contents.pending.filter((item) => item.id !== id), next];
    contents.conflicts = contents.conflicts.filter((item) => item.id !== id);
  });
}

export async function queueWorkerDelete(id, expectedUpdatedAt) {
  return changeWorkerContents((contents) => {
    const original = contents.snapshot.children.find((item) => item.id === id);
    const queued = contents.pending.find((item) => item.id === id);
    if (!original && !queued) throw new Error("This record is no longer available on this device.");
    const details = queued?.child || { name: original.name, birthday: original.birthday, sex: original.sex, parents: original.parents, barangayId: original.barangay_id, purokId: original.purok_id };
    contents.pending = contents.pending.filter((item) => item.id !== id);
    // A queued create may already have reached the server before its response was lost.
    // Always keep a delete operation so a later sync can safely remove that same ID.
    contents.pending.push({ id, kind: "delete", child: details, expectedUpdatedAt: queued ? queued.expectedUpdatedAt : expectedUpdatedAt ?? original?.updated_at ?? null, queuedAt: new Date().toISOString() });
    contents.conflicts = contents.conflicts.filter((item) => item.id !== id);
    if (contents.draft?.id === id) delete contents.draft;
  });
}

export async function syncWorkerChanges() {
  if (!navigator.onLine) return readWorkerContents();
  return exclusive(async () => {
    const userId = activeWorkerId();
    const current = userId && await read(userId);
    if (!current) return null;
    const { record, contents } = current;
    const request = (path, init = {}) => fetch(`/api/backend/${path}`, { ...init, credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(20000) });
    const me = await request("auth/me");
    const identity = await me.json().catch(() => ({}));
    if (!me.ok || identity.user?.id !== userId || identity.user?.role !== "bhw") throw new Error("Sign in to the same worker account to sync. Your queued records are still saved.");
    for (const pending of [...contents.pending]) {
      if (activeWorkerId() !== userId) throw new Error("The account changed. Sync stopped.");
      if (contents.conflicts.some((item) => item.id === pending.id)) continue;
      const deleting = pending.kind === "delete";
      const response = await request(deleting ? `children/${encodeURIComponent(pending.id)}` : "children", {
        method: deleting ? "DELETE" : "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(deleting ? { updatedAt: pending.expectedUpdatedAt, offlineUserId: userId, offlineCreatedChild: pending.expectedUpdatedAt === null ? pending.child : undefined } : { id: pending.id, ...pending.child, expectedUpdatedAt: pending.expectedUpdatedAt, offlineUserId: userId }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 409) {
        const remoteResponse = await request("children");
        if (!remoteResponse.ok) throw new Error("Could not check the online record. Please retry sync.");
        const remote = (await remoteResponse.json()).children.find((item) => item.id === pending.id) || null;
        contents.conflicts.push({ id: pending.id, remote, detectedAt: new Date().toISOString() });
        await persist(record, contents);
        continue;
      }
      if (!response.ok) throw new Error(result.message || "Sync is unavailable. Your queued records are still saved.");
      if (deleting) {
        contents.snapshot.children = contents.snapshot.children.filter((item) => item.id !== pending.id);
        contents.pending = contents.pending.filter((item) => item.id !== pending.id);
        await persist(record, contents);
        continue;
      }
      const child = { ...result.child, barangay_name: contents.snapshot.barangays.find((item) => item.id === pending.child.barangayId)?.name || "", purok_name: contents.snapshot.puroks.find((item) => item.id === pending.child.purokId)?.name || "" };
      contents.snapshot.children = [...contents.snapshot.children.filter((item) => item.id !== pending.id), child];
      contents.pending = contents.pending.filter((item) => item.id !== pending.id);
      await persist(record, contents);
    }
    const responses = await Promise.all(["children", "barangays", "puroks"].map((path) => request(path)));
    if (responses.every((response) => response.ok)) {
      const [children, barangays, puroks] = await Promise.all(responses.map((response) => response.json()));
      contents.snapshot = { ...contents.snapshot, children: children.children, barangays: barangays.barangays, puroks: puroks.puroks, savedAt: new Date().toISOString() };
      await persist(record, contents);
    }
    return contents;
  });
}
