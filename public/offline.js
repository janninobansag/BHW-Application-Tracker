import { activeWorkerId, readWorkerContents, queueWorkerChild, queueWorkerDelete, changeWorkerContents, syncWorkerChanges } from "/worker-offline-store.js";

(() => {
  const $ = (id) => document.getElementById(id);
  let contents = null;
  let busy = false;
  let saving = false;
  let openedUserId = null;
  let page = 1;
  let deleteTarget = null;

  function setNotice(element, message, kind = "") {
    element.textContent = message;
    element.hidden = !message;
    element.className = `notice${kind ? ` ${kind}` : ""}`;
  }

  function setConnection() {
    const connected = navigator.onLine;
    const element = $("connection-status");
    element.textContent = connected ? "Online" : "Offline: saving on this device";
    element.dataset.connected = String(connected);
    element.classList.toggle("online", connected);
    if ($("sync-button")) $("sync-button").disabled = !connected || busy || !contents?.pending.length;
    $("save-record-button").disabled = saving;
    $("export-button").disabled = !connected;
    $("export-button").title = connected ? "Return to the online registry to choose an Excel export" : "Excel export requires internet";
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
      if (pending.kind === "delete") { records.delete(pending.id); continue; }
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
    $("count-total").textContent = String(records.length);
    $("count-male").textContent = String(records.filter((item) => item.sex === "M").length);
    $("count-female").textContent = String(records.filter((item) => item.sex === "F").length);
    $("count-pending").textContent = `${contents.pending.length} pending sync`;
    $("sync-button").disabled = !navigator.onLine || busy || contents.pending.length === 0;
  }

  function makeText(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }

  function showFeedback(message) {
    $("feedback-message").textContent = message;
    $("feedback-dialog").showModal();
  }

  function askDelete(child) {
    deleteTarget = child;
    $("delete-description").textContent = `Delete ${child.name}'s record? The record will be removed from this device and deleted from the database when connected.`;
    $("delete-dialog").showModal();
  }

  async function deleteRecord() {
    if (!deleteTarget || saving) return;
    const target = deleteTarget;
    $("confirm-delete").disabled = true;
    try {
      contents = await queueWorkerDelete(target.id, target.updated_at || undefined);
      $("delete-dialog").close();
      deleteTarget = null;
      if ($("record-id").value === target.id) openEditor(null, false);
      renderRecords();
      showFeedback("Record deleted on this device. The deletion syncs automatically when connected.");
      if (navigator.onLine) void syncChanges();
    } catch (error) {
      $("delete-dialog").close();
      setNotice($("workspace-message"), error instanceof Error ? error.message : "Could not save this deletion. Try again.", "error");
    } finally { $("confirm-delete").disabled = false; }
  }

  function renderRecords() {
    if (!contents) return;
    const list = $("record-list");
    const query = $("record-search").value.trim().toLowerCase();
    const barangay = $("filter-barangay").value;
    const purok = $("filter-purok").value;
    const pendingIds = new Set(contents.pending.map((item) => item.id));
    const records = currentRecords().filter((child) => `${child.name} ${child.parents}`.toLowerCase().includes(query) && (!barangay || child.barangay_id === barangay) && (!purok || child.purok_id === purok));
    const pages = Math.max(1, Math.ceil(records.length / 8));
    page = Math.min(page, pages);
    const first = (page - 1) * 8;
    list.replaceChildren();
    for (const child of records.slice(first, first + 8)) {
      const row = document.createElement("tr");
      const name = makeText("td", "record-child", "");
      name.append(makeText("strong", "", child.name), makeText("small", "", `Born ${child.birthday}`));
      if (pendingIds.has(child.id)) name.append(makeText("small", "record-pending", "Waiting to sync"));
      const age = makeText("td", "record-age", `${ageInMonths(child.birthday)} months`); age.dataset.label = "Age";
      const sex = makeText("td", "record-sex", ""); sex.dataset.label = "Sex"; sex.append(makeText("span", `sex-pill ${child.sex === "F" ? "sex-pill-female" : "sex-pill-male"}`, child.sex));
      const parents = makeText("td", "record-parents", child.parents); parents.dataset.label = "Parents";
      const location = makeText("td", "record-location", ""); location.dataset.label = "Community";
      location.append(makeText("strong", "", child.barangay_name || "Barangay"), makeText("small", "", `${child.purok_name || "Purok not specified"} / ${child.bhw_names || contents.snapshot.user.display_name}`));
      const desktopLocation = makeText("div", "record-desktop-location", "");
      desktopLocation.append(...location.childNodes);
      const disclosure = makeText("details", "record-mobile-disclosure", "");
      disclosure.append(makeText("summary", "", "View details"));
      const details = document.createElement("dl");
      for (const [label, value] of [["Parent / guardian", child.parents], ["Barangay / Purok", `${child.barangay_name} / ${child.purok_name || "Purok not specified"}`], ["Health worker", child.bhw_names || contents.snapshot.user.display_name]]) {
        const item = document.createElement("div");
        item.append(makeText("dt", "", label), makeText("dd", "", value));
        details.append(item);
      }
      disclosure.append(details);
      location.append(desktopLocation, disclosure);
      const actions = makeText("td", "record-actions-cell", "");
      const trigger = makeText("button", "record-menu-trigger", "..."); trigger.type = "button"; trigger.setAttribute("aria-label", `Actions for ${child.name}`); trigger.setAttribute("aria-haspopup", "true"); trigger.setAttribute("aria-expanded", "false");
      const menu = makeText("div", "record-menu-content cached-menu-content", ""); menu.setAttribute("popover", "auto");
      const edit = makeText("button", "record-menu-item", "Edit"); edit.type = "button";
      const remove = makeText("button", "record-menu-item record-menu-delete", "Delete"); remove.type = "button";
      const closeMenu = () => { if (menu.hidePopover) menu.hidePopover(); else menu.hidden = true; trigger.setAttribute("aria-expanded", "false"); };
      edit.addEventListener("click", () => { closeMenu(); openEditor(child); });
      remove.addEventListener("click", () => { closeMenu(); askDelete(child); });
      menu.append(edit, remove);
      if (!menu.showPopover) menu.hidden = true;
      menu.addEventListener("toggle", (event) => trigger.setAttribute("aria-expanded", String(event.newState === "open")));
      trigger.addEventListener("click", () => {
        const rect = trigger.getBoundingClientRect();
        menu.style.left = `${Math.max(12, Math.min(window.innerWidth - 192, rect.right - 180))}px`;
        menu.style.top = `${Math.max(12, Math.min(window.innerHeight - 120, rect.bottom + 4))}px`;
        if (menu.showPopover) menu.togglePopover(); else menu.hidden = !menu.hidden;
        trigger.setAttribute("aria-expanded", String(menu.showPopover ? menu.matches(":popover-open") : !menu.hidden));
        edit.focus();
      });
      actions.append(trigger, menu); row.append(name, age, sex, parents, location, actions); list.append(row);
    }
    $("empty-records").hidden = records.length !== 0;
    $("page-summary").textContent = `Showing ${records.length ? first + 1 : 0} to ${Math.min(first + 8, records.length)} of ${records.length} records`;
    $("page-number").textContent = `Page ${page} of ${pages}`;
    $("page-previous").disabled = page <= 1;
    $("page-next").disabled = page >= pages;
    setCounts(records);
    $("registry-result-count").textContent = `${records.length} ${records.length === 1 ? "child" : "children"} in your care`;
    const filterCount = Number(Boolean(barangay)) + Number(Boolean(purok));
    $("filter-toggle-label").textContent = `Filters${filterCount ? ` (${filterCount})` : ""}`;
    $("active-location-filters").hidden = !filterCount;
    $("active-location-label").textContent = [contents.snapshot.barangays.find((item) => item.id === barangay)?.name, contents.snapshot.puroks.find((item) => item.id === purok)?.name].filter(Boolean).join(" / ");
    renderConflicts();
  }

  function fillFilterPuroks() {
    const barangay = $("filter-barangay").value;
    const field = $("filter-purok");
    field.replaceChildren(new Option(barangay ? "All Puroks" : "Select a barangay first", ""));
    for (const item of contents.snapshot.puroks.filter((item) => item.barangay_id === barangay)) field.add(new Option(item.name, item.id));
    field.disabled = !barangay;
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

  function openEditor(child = null, focus = true) {
    const form = $("child-form");
    form.reset();
    $("record-id").value = child?.id || "";
    $("record-version").value = child?.updated_at || contents.snapshot.children.find((item) => item.id === child?.id)?.updated_at || "";
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
    $("save-record-button").textContent = child ? "Save changes" : "Save child record";
    $("record-editor").hidden = false;
    $("cancel-edit-button").hidden = !child;
    if (focus) {
      $("registry-grid").classList.add("show-new-record");
      $("new-record-button").setAttribute("aria-expanded", "true");
      $("new-record-button").textContent = "Close new record";
      $("record-editor").scrollIntoView({ behavior: "smooth", block: "start" });
      $("child-name").focus({ preventScroll: true });
    }
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

    if (saving) return;
    saving = true;
    setConnection();
    const id = $("record-id").value || crypto.randomUUID();
    try {
      contents = await queueWorkerChild(child, id, $("record-version").value || undefined);
      $("record-id").value = id;
      await changeWorkerContents((state) => { delete state.draft; });
      openEditor(null, false);
      $("registry-grid").classList.remove("show-new-record");
      $("new-record-button").setAttribute("aria-expanded", "false");
      $("new-record-button").textContent = "+ Add a child record";
      showFeedback("Saved on this device. Changes sync automatically when connected.");
      renderRecords();
      if (navigator.onLine) void syncChanges();
    } catch (error) {
      setNotice($("workspace-message"), error instanceof Error ? error.message : "Could not save to this device. Keep the form open and retry.", "error");
    } finally { saving = false; setConnection(); }
  }

  async function syncChanges() {
    if (!contents || busy || !navigator.onLine) return;
    busy = true;
    setConnection();
    try {
      const refreshed = await syncWorkerChanges();
      if (!refreshed || activeWorkerId() !== openedUserId) return closeWorkspace();
      contents = refreshed;
      if (!["child-name", "child-birthday", "child-parents", "record-id", "child-sex", "child-barangay", "child-purok"].some((id) => $(id).value)) renderLookups();
      renderRecords();
      if (contents.conflicts.length) setNotice($("workspace-message"), "Some records changed online. Review the versions below before syncing those changes.", "error");
      else setNotice($("workspace-message"), "");
      setConnection();
      const editing = ["child-name", "child-birthday", "child-parents", "record-id", "child-sex", "child-barangay", "child-purok"].some((id) => $(id).value);
      if (!contents.pending.length && !contents.draft && !editing && !document.querySelector("dialog[open]")) {
        // Verify that the full page is available before leaving the working cache.
        const onlinePage = await fetch("/", { cache: "no-store", signal: AbortSignal.timeout(10000) });
        const stillEditing = ["child-name", "child-birthday", "child-parents", "record-id", "child-sex", "child-barangay", "child-purok"].some((id) => $(id).value);
        if (onlinePage.ok && !stillEditing && !document.querySelector("dialog[open]")) {
          const params = new URLSearchParams();
          if ($("record-search").value) params.set("q", $("record-search").value);
          if ($("filter-barangay").value) params.set("barangay", $("filter-barangay").value);
          if ($("filter-purok").value) params.set("purok", $("filter-purok").value);
          window.location.replace(`/${params.size ? `?${params}` : ""}`);
        }
      }
    } catch (error) {
      setNotice($("workspace-message"), error instanceof Error ? error.message : "Connection unavailable. Changes remain saved and will retry automatically.", "error");
    } finally { busy = false; setConnection(); }
  }

  async function resolveConflict(id, action) {
    contents = await changeWorkerContents((contents) => {
    const conflict = contents.conflicts.find((item) => item.id === id);
    const pending = contents.pending.find((item) => item.id === id);
    if (!conflict || !pending) return;
    if (action === "server" && conflict.remote) {
      contents.snapshot.children = contents.snapshot.children.filter((item) => item.id !== id);
      contents.snapshot.children.push(conflict.remote);
      contents.pending = contents.pending.filter((item) => item.id !== id);
    } else if (action === "local" && conflict.remote) {
      pending.expectedUpdatedAt = conflict.remote.updated_at || null;
      if (pending.kind !== "delete") pending.kind = "update";
    } else if (action === "copy") {
      const nextId = crypto.randomUUID();
      contents.snapshot.children = contents.snapshot.children.filter((item) => item.id !== id);
      contents.pending = contents.pending.filter((item) => item.id !== id);
      contents.pending.push({ ...pending, id: nextId, kind: "create", expectedUpdatedAt: null, queuedAt: new Date().toISOString() });
    }
    contents.conflicts = contents.conflicts.filter((item) => item.id !== id);
    });
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
        keepLocal.textContent = pending.kind === "delete" ? "Delete the updated record" : "Keep my changes";
        keepLocal.addEventListener("click", () => void resolveConflict(conflict.id, "local"));
        actions.append(keepServer, keepLocal);
      } else if (pending.kind !== "delete") {
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

  async function openWorkspace() {
    try {
      contents = await readWorkerContents();
      if (!contents) throw new Error("Sign in as a worker while online once on this device. Offline access will then be prepared automatically.");
      openedUserId = contents.snapshot.user.id;
      $("access-panel").hidden = true;
      $("workspace").hidden = false;
      $("welcome").textContent = `Signed in as ${contents.snapshot.user.display_name}`;
      $("worker-name").textContent = contents.snapshot.user.display_name;
      $("worker-avatar").textContent = contents.snapshot.user.display_name.charAt(0).toUpperCase();
      $("account-name").textContent = contents.snapshot.user.display_name;
      renderLookups();
      const params = new URLSearchParams(window.location.search);
      $("record-search").value = params.get("q") || "";
      $("filter-barangay").value = params.get("barangay") || "";
      fillFilterPuroks(); $("filter-purok").value = params.get("purok") || "";
      renderRecords();
      setConnection();
      openEditor(null, false);
      if (contents.draft) {
        const { id, child, updatedAt } = contents.draft;
        openEditor({ id, updated_at: updatedAt, name: child.name, birthday: child.birthday, sex: child.sex, parents: child.parents, barangay_id: child.barangayId, purok_id: child.purokId });
        $("editor-title").textContent = id ? "Edit child record" : "Add a child";
        setNotice($("workspace-message"), "Your unfinished form was kept when the connection changed. Continue filling it in, then save.");
      }
      if (navigator.onLine) void syncChanges();
    } catch (error) {
      setNotice($("access-message"), error instanceof Error ? error.message : "Offline storage is unavailable in this browser.", "error");
    }
  }

  function renderLookups() {
    const barangay = $("child-barangay");
    barangay.replaceChildren(new Option("Select a barangay", ""));
    for (const item of contents.snapshot.barangays) barangay.add(new Option(item.name, item.id));
    $("snapshot-date").textContent = `Last updated ${new Date(contents.snapshot.savedAt).toLocaleString()}.`;
    const selected = $("filter-barangay").value;
    const selectedPurok = $("filter-purok").value;
    $("filter-barangay").replaceChildren(new Option("All assigned barangays", ""));
    for (const item of contents.snapshot.barangays) $("filter-barangay").add(new Option(item.name, item.id));
    $("filter-barangay").value = selected;
    fillFilterPuroks(); $("filter-purok").value = selectedPurok;
  }

  function closeWorkspace() {
    contents = null;
    $("workspace").hidden = true;
    $("access-panel").hidden = false;
    $("record-list").replaceChildren();
    $("conflicts").replaceChildren();
    $("child-form").reset();
    setNotice($("access-message"), "Local access ended. Sign in online to continue with your account.");
  }

  $("child-form").addEventListener("submit", (event) => void saveChild(event));
  $("child-birthday").addEventListener("change", updateBirthdayHint);
  $("child-barangay").addEventListener("change", () => fillPuroks());
  $("record-search").addEventListener("input", () => { page = 1; renderRecords(); });
  $("record-filters").addEventListener("submit", (event) => event.preventDefault());
  $("filter-toggle").addEventListener("click", () => { const expanded = $("record-filters").classList.toggle("filters-expanded"); $("filter-toggle").setAttribute("aria-expanded", String(expanded)); });
  $("clear-location-filters").addEventListener("click", () => { $("filter-barangay").value = ""; fillFilterPuroks(); page = 1; renderRecords(); });
  $("filter-barangay").addEventListener("change", () => { fillFilterPuroks(); page = 1; renderRecords(); });
  $("filter-purok").addEventListener("change", () => { page = 1; renderRecords(); });
  $("page-previous").addEventListener("click", () => { page = Math.max(1, page - 1); renderRecords(); });
  $("page-next").addEventListener("click", () => { page += 1; renderRecords(); });
  $("confirm-delete").addEventListener("click", () => void deleteRecord());
  $("cancel-delete").addEventListener("click", () => $("delete-dialog").close());
  $("feedback-close").addEventListener("click", () => $("feedback-dialog").close());
  $("account-close").addEventListener("click", () => $("account-dialog").close());
  $("account-button").addEventListener("click", () => $("account-dialog").showModal());
  $("export-button").addEventListener("click", () => {
    if (["child-name", "child-birthday", "child-parents", "record-id"].some((id) => $(id).value)) return showFeedback("Save or cancel your current record before returning to the online registry for Excel export.");
    if (navigator.onLine) window.location.assign(new URL("/", window.location.origin).href);
  });
  $("new-record-button").addEventListener("click", () => {
    const open = $("registry-grid").classList.toggle("show-new-record");
    $("new-record-button").setAttribute("aria-expanded", String(open));
    $("new-record-button").textContent = open ? "Close new record" : "+ Add a child record";
    if (open) $("child-name").focus();
  });
  $("cancel-edit-button").addEventListener("click", () => { openEditor(null, false); $("registry-grid").classList.remove("show-new-record"); $("new-record-button").setAttribute("aria-expanded", "false"); });
  $("sync-button").addEventListener("click", () => void syncChanges());
  window.addEventListener("online", () => { setConnection(); if (contents) void syncChanges(); });
  window.addEventListener("offline", setConnection);
  window.addEventListener("storage", () => { if (activeWorkerId() !== openedUserId) closeWorkspace(); });
  window.addEventListener("focus", () => { if (activeWorkerId() !== openedUserId) closeWorkspace(); else if (navigator.onLine) void syncChanges(); });
  setInterval(() => { if (contents && navigator.onLine) void syncChanges(); }, 30000);
  void openWorkspace();
  setConnection();
})();
