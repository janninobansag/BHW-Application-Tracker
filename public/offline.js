(() => {
  const DATABASE = "bhw-offline-vault";
  const STORE = "vaults";
  const ITERATIONS = 310000;
  const $ = (id) => document.getElementById(id);
  let vault = null;
  let contents = null;
  let stateKey = null;
  let busy = false;
  let autoLockTimer = null;

  function base64ToBytes(value) {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  }

  function bytesToBase64(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE, { keyPath: "username" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Offline storage is unavailable."));
    });
  }

  async function getVault(username) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, "readonly");
      const request = transaction.objectStore(STORE).get(username.trim().toLowerCase());
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not read the offline copy."));
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => reject(transaction.error || new Error("Could not read the offline copy."));
    });
  }

  async function putVault(record) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put(record);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error || new Error("Could not save offline changes."));
      transaction.onabort = () => reject(transaction.error || new Error("Could not save offline changes."));
    });
  }

  async function deriveKey(passphrase, salt) {
    const material = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(passphrase),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  }

  async function encryptState(state, passphrase) {
    const salt = base64ToBytes(vault.salt);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = stateKey || await deriveKey(passphrase, salt);
    const additionalData = new TextEncoder().encode(`${vault.username}\n${vault.userId}`);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData },
      key,
      new TextEncoder().encode(JSON.stringify(state)),
    );
    return {
      username: contents.snapshot.user.username.trim().toLowerCase(),
      userId: contents.snapshot.user.id,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
      updatedAt: new Date().toISOString(),
    };
  }

  async function saveState() {
    if (!vault || !contents) return;
    const replacement = await encryptState(contents, "");
    await putVault(replacement);
    vault = replacement;
  }

  async function unlock(record, passphrase) {
    const key = await deriveKey(passphrase, base64ToBytes(record.salt));
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(record.iv), additionalData: new TextEncoder().encode(`${record.username}\n${record.userId}`) },
      key,
      base64ToBytes(record.ciphertext),
    );
    const parsed = JSON.parse(new TextDecoder().decode(plaintext));
    if (!parsed?.snapshot?.user?.id || parsed.snapshot.user.id !== record.userId || parsed.snapshot.user.username.trim().toLowerCase() !== record.username) {
      throw new Error("This offline copy is invalid or incomplete.");
    }
    stateKey = key;
    parsed.pending = Array.isArray(parsed.pending) ? parsed.pending : [];
    parsed.conflicts = Array.isArray(parsed.conflicts) ? parsed.conflicts : [];
    return parsed;
  }

  function setNotice(element, message, kind = "") {
    element.textContent = message;
    element.hidden = !message;
    element.className = `notice${kind ? ` ${kind}` : ""}`;
  }

  function setConnection() {
    const connected = navigator.onLine;
    const element = $("connection-status");
    element.textContent = connected ? "Online" : "Offline";
    element.classList.toggle("online", connected);
    if ($("sync-button")) $("sync-button").disabled = !connected || busy || !contents?.pending.length;
    if ($("lock-button")) $("lock-button").disabled = busy;
    if ($("new-record-button")) $("new-record-button").disabled = busy;
    if ($("record-search")) $("record-search").disabled = busy;
    if ($("child-form")) $("child-form").querySelectorAll("input, select, button").forEach((field) => { field.disabled = busy; });
  }

  function todayInManila() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date());
    const value = (type) => parts.find((part) => part.type === type)?.value || "";
    return `${value("year")}-${value("month")}-${value("day")}`;
  }

  function ageInMonths(birthday) {
    const [by, bm, bd] = birthday.split("-").map(Number);
    const [y, m, d] = todayInManila().split("-").map(Number);
    return (y - by) * 12 + m - bm - (d < bd ? 1 : 0);
  }

  function updateBirthdayHint() {
    const value = $("child-birthday").value;
    $("birthday-hint").textContent = value
      ? `Age: ${ageInMonths(value)} full months`
      : "Age appears after you choose a birthday.";
  }

  function currentRecords() {
    const records = new Map(contents.snapshot.children.map((child) => [child.id, { ...child }]));
    for (const pending of contents.pending) {
      const existing = records.get(pending.id) || {};
      const barangay = contents.snapshot.barangays.find((item) => item.id === pending.child.barangayId);
      const purok = contents.snapshot.puroks.find((item) => item.id === pending.child.purokId);
      records.set(pending.id, {
        ...existing,
        id: pending.id,
        name: pending.child.name,
        birthday: pending.child.birthday,
        sex: pending.child.sex,
        parents: pending.child.parents,
        barangay_id: pending.child.barangayId,
        barangay_name: barangay?.name || "",
        purok_id: pending.child.purokId,
        purok_name: purok?.name || "",
        updated_at: pending.expectedUpdatedAt,
      });
    }
    return [...records.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  function setCounts(records) {
    $("count-total").textContent = `${records.length} children`;
    $("count-male").textContent = `${records.filter((item) => item.sex === "M").length} male`;
    $("count-female").textContent = `${records.filter((item) => item.sex === "F").length} female`;
    $("count-pending").textContent = `${contents.pending.length} pending sync`;
    $("sync-button").disabled = !navigator.onLine || busy || contents.pending.length === 0;
  }

  function makeText(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }

  function renderRecords() {
    const list = $("record-list");
    const query = $("record-search").value.trim().toLowerCase();
    const pendingIds = new Set(contents.pending.map((item) => item.id));
    const records = currentRecords().filter((child) => `${child.name} ${child.parents}`.toLowerCase().includes(query));
    list.replaceChildren();
    for (const child of records) {
      const card = document.createElement("article");
      card.className = "record";
      const details = document.createElement("div");
      details.append(makeText("strong", "", child.name));
      details.append(makeText("small", "", `${child.birthday} · ${ageInMonths(child.birthday)} months · ${child.sex} · ${child.parents}`));
      details.append(makeText("small", "", `${child.barangay_name || "Barangay"} · ${child.purok_name || "Purok not specified"}`));
      if (pendingIds.has(child.id)) details.append(makeText("small", "record-state", "Waiting to sync"));
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => openEditor(child));
      card.append(details, edit);
      list.append(card);
    }
    $("empty-records").hidden = records.length !== 0;
    setCounts(currentRecords());
    renderConflicts();
  }

  function fillPuroks(selectedId = "") {
    const barangayId = $("child-barangay").value;
    const field = $("child-purok");
    field.replaceChildren(new Option("Select a Purok", ""));
    for (const item of contents.snapshot.puroks.filter((purok) => purok.barangay_id === barangayId)) {
      field.add(new Option(item.name, item.id));
    }
    field.value = selectedId;
  }

  function openEditor(child = null) {
    const form = $("child-form");
    form.reset();
    $("record-id").value = child?.id || "";
    $("child-name").value = child?.name || "";
    $("child-birthday").value = child?.birthday || "";
    $("child-birthday").max = todayInManila();
    updateBirthdayHint();
    $("child-sex").value = child?.sex || "";
    $("child-parents").value = child?.parents || "";
    $("child-barangay").replaceChildren(new Option("Select a barangay", ""));
    for (const item of contents.snapshot.barangays) $("child-barangay").add(new Option(item.name, item.id));
    $("child-barangay").value = child?.barangay_id || "";
    fillPuroks(child?.purok_id || "");
    $("editor-title").textContent = child ? "Edit child record" : "Add a child";
    $("save-record-button").textContent = child ? "Save offline changes" : "Save offline";
    $("record-editor").hidden = false;
    $("record-editor").scrollIntoView({ behavior: "smooth", block: "start" });
    $("child-name").focus();
  }

  function validateChild(child) {
    if (!child.name.trim() || child.name.trim().length > 120) return "Enter a child name under 120 characters.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(child.birthday) || child.birthday > todayInManila()) return "Enter a valid birthday that is not in the future.";
    const date = new Date(`${child.birthday}T00:00:00Z`);
    if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== child.birthday) return "Enter a valid birthday.";
    if (child.sex !== "F" && child.sex !== "M") return "Select F or M.";
    if (!child.parents.trim() || child.parents.trim().length > 240) return "Enter the parents' names under 240 characters.";
    if (!contents.snapshot.barangays.some((item) => item.id === child.barangayId)) return "Choose one of your assigned barangays.";
    if (!contents.snapshot.puroks.some((item) => item.id === child.purokId && item.barangay_id === child.barangayId)) return "Choose a Purok assigned under that barangay.";
    return "";
  }

  async function saveChild(event) {
    event.preventDefault();
    const child = {
      name: $("child-name").value.trim(),
      birthday: $("child-birthday").value,
      sex: $("child-sex").value,
      parents: $("child-parents").value.trim(),
      barangayId: $("child-barangay").value,
      purokId: $("child-purok").value,
    };
    const problem = validateChild(child);
    if (problem) return setNotice($("workspace-message"), problem, "error");

    const id = $("record-id").value || crypto.randomUUID();
    const queued = contents.pending.find((item) => item.id === id);
    const original = contents.snapshot.children.find((item) => item.id === id);
    const kind = queued?.kind || (original ? "update" : "create");
    const expectedUpdatedAt = queued ? queued.expectedUpdatedAt : (original?.updated_at || null);
    const next = {
      id,
      kind,
      expectedUpdatedAt,
      child,
      queuedAt: queued?.queuedAt || new Date().toISOString(),
    };
    const index = contents.pending.findIndex((item) => item.id === id);
    if (index >= 0) contents.pending[index] = next;
    else contents.pending.push(next);
    contents.conflicts = contents.conflicts.filter((item) => item.id !== id);

    try {
      await saveState();
      $("record-editor").hidden = true;
      setNotice($("workspace-message"), "Saved on this device. It will sync when you are online.", "success");
      renderRecords();
      if (navigator.onLine) void syncChanges();
    } catch {
      setNotice($("workspace-message"), "Could not save to this device. Check available storage and try again.", "error");
    }
  }

  async function refreshSnapshot() {
    const endpoints = ["children", "barangays", "puroks"];
    const responses = await Promise.all(endpoints.map((path) => fetch(`/api/backend/${path}`, {
      credentials: "same-origin",
      cache: "no-store",
    })));
    const unauthorized = responses.find((response) => response.status === 401);
    if (unauthorized) throw new Error("Sign in online again before syncing queued records.");
    const failed = responses.find((response) => !response.ok);
    if (failed) throw new Error("The BHW service could not refresh the assigned records.");
    const [childrenResult, barangaysResult, puroksResult] = await Promise.all(responses.map((response) => response.json()));
    return {
      user: contents.snapshot.user,
      children: childrenResult.children,
      barangays: barangaysResult.barangays,
      puroks: puroksResult.puroks,
      savedAt: new Date().toISOString(),
    };
  }

  async function fetchCurrentChild(id) {
    try {
      const response = await fetch("/api/backend/children", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) return null;
      const data = await response.json();
      return data.children.find((item) => item.id === id) || null;
    } catch {
      return null;
    }
  }

  async function syncChanges() {
    if (!contents?.pending.length || busy) return;
    if (!navigator.onLine) return setNotice($("workspace-message"), "You are offline. Queued changes remain saved on this device.", "error");
    busy = true;
    setConnection();
    setNotice($("workspace-message"), "Syncing queued changes…");
    try {
      for (const pending of [...contents.pending]) {
        const response = await fetch("/api/backend/children", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: pending.id,
            ...pending.child,
            expectedUpdatedAt: pending.expectedUpdatedAt,
          }),
        });
        if (response.status === 409) {
          const remote = await fetchCurrentChild(pending.id);
          contents.conflicts = contents.conflicts.filter((item) => item.id !== pending.id);
          contents.conflicts.push({ id: pending.id, remote, detectedAt: new Date().toISOString() });
          await saveState();
          setNotice($("workspace-message"), `A newer online version of ${pending.child.name} exists. Choose which version to keep below.`, "error");
          renderRecords();
          return;
        }
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 401) throw new Error("Sign in online again before syncing queued records. Your offline changes are still saved.");
          if (response.status === 400) throw new Error(`${result.message || "This record no longer matches your assignments."} Your offline changes are still saved.`);
          throw new Error(`${result.message || "The service could not save a record."} Your offline changes are still saved.`);
        }
        const serverChild = result.child || {
          id: pending.id,
          name: pending.child.name,
          birthday: pending.child.birthday,
          sex: pending.child.sex,
          parents: pending.child.parents,
          barangay_id: pending.child.barangayId,
          purok_id: pending.child.purokId,
          created_by: contents.snapshot.user.id,
          created_at: pending.queuedAt,
          updated_at: new Date().toISOString(),
        };
        serverChild.barangay_name = contents.snapshot.barangays.find((item) => item.id === pending.child.barangayId)?.name || "";
        serverChild.purok_name = contents.snapshot.puroks.find((item) => item.id === pending.child.purokId)?.name || "";
        const storedIndex = contents.snapshot.children.findIndex((item) => item.id === pending.id);
        if (storedIndex >= 0) contents.snapshot.children[storedIndex] = serverChild;
        else contents.snapshot.children.push(serverChild);
        contents.pending = contents.pending.filter((item) => item.id !== pending.id);
        await saveState();
        renderRecords();
      }
      try {
        contents.snapshot = await refreshSnapshot();
        await saveState();
      } catch (refreshError) {
        if (contents.pending.length) throw refreshError;
      }
      setNotice($("workspace-message"), "All queued changes are synced.", "success");
      renderRecords();
    } catch (error) {
      setNotice($("workspace-message"), error instanceof Error ? error.message : "Sync failed. Your offline changes are still saved.", "error");
    } finally {
      busy = false;
      setConnection();
      renderRecords();
    }
  }

  async function resolveConflict(id, action) {
    const conflict = contents.conflicts.find((item) => item.id === id);
    const pending = contents.pending.find((item) => item.id === id);
    if (!conflict || !pending) return;
    if (action === "server" && conflict.remote) {
      contents.snapshot.children = contents.snapshot.children.filter((item) => item.id !== id);
      contents.snapshot.children.push(conflict.remote);
      contents.pending = contents.pending.filter((item) => item.id !== id);
    } else if (action === "local" && conflict.remote) {
      pending.expectedUpdatedAt = conflict.remote.updated_at || null;
      pending.kind = "update";
    } else if (action === "copy") {
      const nextId = crypto.randomUUID();
      contents.snapshot.children = contents.snapshot.children.filter((item) => item.id !== id);
      contents.pending = contents.pending.filter((item) => item.id !== id);
      contents.pending.push({ ...pending, id: nextId, kind: "create", expectedUpdatedAt: null, queuedAt: new Date().toISOString() });
    }
    contents.conflicts = contents.conflicts.filter((item) => item.id !== id);
    await saveState();
    renderRecords();
    setNotice($("workspace-message"), action === "server" ? "The online version is now on this device." : "Saved your offline version choice. Sync again to send it.", "success");
    if (action !== "server" && navigator.onLine) void syncChanges();
  }

  function renderConflicts() {
    const root = $("conflicts");
    root.replaceChildren();
    if (!contents.conflicts.length) {
      root.hidden = true;
      return;
    }
    root.hidden = false;
    for (const conflict of contents.conflicts) {
      const pending = contents.pending.find((item) => item.id === conflict.id);
      if (!pending) continue;
      const card = document.createElement("section");
      card.className = "conflict";
      card.append(makeText("h3", "", `Resolve changes for ${pending.child.name}`));
      card.append(makeText("p", "", conflict.remote
        ? `The online record was updated at ${new Date(conflict.remote.updated_at || conflict.detectedAt).toLocaleString()}. Your offline edit is still saved.`
        : "The online record is no longer available to your account. Your offline edit is still saved."));
      if (conflict.remote) {
        const remote = document.createElement("p");
        remote.textContent = `Online: ${conflict.remote.name}, ${conflict.remote.birthday}, ${conflict.remote.sex}, ${conflict.remote.parents}`;
        card.append(remote);
        const local = document.createElement("p");
        local.textContent = `This device: ${pending.child.name}, ${pending.child.birthday}, ${pending.child.sex}, ${pending.child.parents}`;
        card.append(local);
      }
      const actions = document.createElement("div");
      actions.className = "actions";
      if (conflict.remote) {
        const keepServer = document.createElement("button");
        keepServer.type = "button";
        keepServer.textContent = "Use online version";
        keepServer.addEventListener("click", () => void resolveConflict(conflict.id, "server"));
        const keepLocal = document.createElement("button");
        keepLocal.type = "button";
        keepLocal.className = "primary";
        keepLocal.textContent = "Keep my offline changes";
        keepLocal.addEventListener("click", () => void resolveConflict(conflict.id, "local"));
        actions.append(keepServer, keepLocal);
      } else {
        const copy = document.createElement("button");
        copy.type = "button";
        copy.className = "primary";
        copy.textContent = "Save offline edit as a new record";
        copy.addEventListener("click", () => void resolveConflict(conflict.id, "copy"));
        actions.append(copy);
      }
      card.append(actions);
      root.append(card);
    }
  }

  async function handleUnlock(event) {
    event.preventDefault();
    const username = $("offline-username").value.trim().toLowerCase();
    const passphrase = $("offline-passphrase").value;
    setNotice($("unlock-message"), "Unlocking encrypted copy…");
    try {
      const record = await getVault(username);
      if (!record) throw new Error("No offline copy was found for that username on this device.");
      const unlocked = await unlock(record, passphrase);
      vault = record;
      contents = unlocked;
      $("offline-passphrase").value = "";
      $("unlock-panel").hidden = true;
      $("workspace").hidden = false;
      $("welcome").textContent = `Hello, ${contents.snapshot.user.display_name}`;
      $("snapshot-date").textContent = `Offline copy saved ${new Date(contents.snapshot.savedAt).toLocaleString()}.`;
      renderLookups();
      renderRecords();
      setConnection();
      resetAutoLock();
      if (contents.pending.length) setNotice($("workspace-message"), `${contents.pending.length} change${contents.pending.length === 1 ? " is" : "s are"} waiting to sync.`);
      if (navigator.onLine && contents.pending.length) void syncChanges();
    } catch (error) {
      setNotice($("unlock-message"), error instanceof Error ? error.message : "Could not unlock this copy.", "error");
    }
  }

  function renderLookups() {
    const barangay = $("child-barangay");
    barangay.replaceChildren(new Option("Select a barangay", ""));
    for (const item of contents.snapshot.barangays) barangay.add(new Option(item.name, item.id));
    $("snapshot-date").textContent = `Offline copy saved ${new Date(contents.snapshot.savedAt).toLocaleString()}.`;
  }

  function lockWorkspace() {
    clearTimeout(autoLockTimer);
    contents = null;
    vault = null;
    stateKey = null;
    $("workspace").hidden = true;
    $("unlock-panel").hidden = false;
    $("record-editor").hidden = true;
    setNotice($("unlock-message"), "Offline records are locked.", "success");
  }

  function resetAutoLock() {
    clearTimeout(autoLockTimer);
    if (contents) autoLockTimer = setTimeout(lockWorkspace, 5 * 60 * 1000);
  }

  $("unlock-form").addEventListener("submit", (event) => void handleUnlock(event));
  $("child-form").addEventListener("submit", (event) => void saveChild(event));
  $("child-birthday").addEventListener("change", updateBirthdayHint);
  $("child-barangay").addEventListener("change", () => fillPuroks());
  $("record-search").addEventListener("input", renderRecords);
  $("new-record-button").addEventListener("click", () => openEditor());
  $("cancel-edit-button").addEventListener("click", () => { $("record-editor").hidden = true; });
  $("sync-button").addEventListener("click", () => void syncChanges());
  $("lock-button").addEventListener("click", lockWorkspace);
  window.addEventListener("online", () => { setConnection(); if (contents?.pending.length) void syncChanges(); });
  window.addEventListener("offline", setConnection);
  ["pointerdown", "keydown", "touchstart"].forEach((eventName) => window.addEventListener(eventName, resetAutoLock, { passive: true }));
  setConnection();
})();
