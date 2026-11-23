"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import type { OfflineChildInput, OfflineSnapshot } from "@/Client/offline/vault";
import { prepareWorker, changeWorkerContents, queueWorkerChild, queueWorkerDelete, syncWorkerChanges } from "@/public/worker-offline-store.js";
import { validChildDetails } from "@/Services/child-records";
import { FeedbackDialog } from "@/Client/views/components/feedback-dialog";

const subscribeToStatusSlot = () => () => {};
const getStatusSlot = () => document.getElementById("record-status-slot");
const getServerStatusSlot = () => null;

export function AutomaticWorkerRecords({ snapshot, program = "deworming" }: { snapshot: OfflineSnapshot; program?: "deworming" | "timbang" }) {
  const returnTo = program === "timbang" ? "/operation-timbang" : "/";
  const offlineUrl = program === "timbang" ? "/offline.html?program=timbang" : "/offline.html";
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState("");
  const [syncStatus, setSyncStatus] = useState("Preparing device records");
  const statusSlot = useSyncExternalStore(subscribeToStatusSlot, getStatusSlot, getServerStatusSlot);
  useEffect(() => {
    let disposed = false;
    let saving = false;
    let syncing = false;
    let unavailable = false;
    const ready = prepareWorker(snapshot, () => !disposed, program);
    void ready.catch(() => { unavailable = true; });
    const readForm = (element: HTMLFormElement) => {
      const data = new FormData(element);
      const value = (key: string) => String(data.get(key) || "").trim();
      const firstName = value("firstName");
      const middleInitial = value("middleInitial");
      const surname = value("surname");
      return { id: value("id"), updatedAt: value("updatedAt"), child: { name: [firstName, middleInitial, surname].filter(Boolean).join(" "), firstName, middleInitial, surname, birthday: value("birthday"), parents: value("parents"), sex: value("sex"), barangayId: value("barangayId"), purokId: value("purokId"), ...(program === "timbang" ? { weight: value("weight"), height: value("height"), muac: value("muac") } : {}) } };
    };
    const sync = async () => {
      if (syncing || !navigator.onLine || disposed) return;
      syncing = true;
      try {
        await ready;
        const contents = await syncWorkerChanges(program);
        if (!disposed) {
          setNotice(contents?.pending.length ? `${contents.pending.length} record changes are waiting for review.` : "");
          setSyncStatus(contents?.pending.length ? `${contents.pending.length} changes waiting to sync` : "Online · All changes synced");
        }
      } catch (error) {
        if (!disposed) { setNotice(error instanceof Error ? error.message : "Connection unavailable. Records remain saved on this device."); setSyncStatus("Changes saved on this device"); }
      } finally { syncing = false; }
    };
    const switchOffline = async () => {
      if (saving) return;
      try {
        await ready;
        const element = document.querySelector<HTMLFormElement>("form[data-offline-draft-form]");
        if (element) {
          const draft = readForm(element);
          if (Object.values(draft.child).some(Boolean)) await changeWorkerContents((contents) => { contents.draft = draft; }, program);
        }
        if (!disposed) { const params = new URLSearchParams(window.location.search); if (program === "timbang") params.set("program", "timbang"); window.location.replace(`/offline.html${params.size ? `?${params}` : ""}`); }
      } catch {
        if (!disposed) setNotice("Offline storage is unavailable in this browser. Keep this form open until you reconnect.");
      }
    };
    const submit = async (event: SubmitEvent) => {
      if (!(event.target instanceof HTMLFormElement) || !event.target.matches("[data-offline-draft-form], [data-offline-delete-form]")) return;
      if (unavailable && navigator.onLine) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (saving) return;
      const element = event.target;
      const deleting = element.hasAttribute("data-offline-delete-form");
      const draft = readForm(element);
      if (!deleting && (!draft.child.firstName || !draft.child.surname || (draft.child.middleInitial && !/^\p{L}\.?$/u.test(draft.child.middleInitial)) || !validChildDetails(draft.child))) { setNotice("Check the child's surname, middle initial, first name, birthday, sex, and parents before saving."); return; }
      saving = true;
      const button = element.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (button) button.disabled = true;
      let savedLocally = false;
      try {
        await ready;
        const offlineId = deleting ? String(new FormData(element).get("childId")) : draft.id || element.dataset.offlineId || crypto.randomUUID();
        if (deleting) await queueWorkerDelete(offlineId, draft.updatedAt || undefined, program);
        else await queueWorkerChild(draft.child as OfflineChildInput, offlineId, draft.updatedAt || undefined, program);
        element.dataset.offlineId = offlineId;
        savedLocally = true;
        if (!navigator.onLine) { window.location.assign(new URL(offlineUrl, window.location.origin).href); return; }
        const contents = await syncWorkerChanges(program);
        if (contents?.pending.length) { window.location.assign(new URL(offlineUrl, window.location.origin).href); return; }
        setSaved(crypto.randomUUID());
        setNotice("");
        if (draft.id) router.push(returnTo);
        else { delete element.dataset.offlineId; element.reset(); router.refresh(); }
      } catch (error) {
        if (savedLocally) { window.location.assign(new URL(offlineUrl, window.location.origin).href); return; }
        if (unavailable && navigator.onLine) {
          saving = false;
          if (button) button.disabled = false;
          element.requestSubmit();
          return;
        }
        setNotice(error instanceof Error ? error.message : "Unable to save. Keep this form open and try again.");
      } finally { saving = false; if (button) button.disabled = false; }
    };
    void ready.then(() => { if (!navigator.onLine) void switchOffline(); else void sync(); }).catch(() => {
      if (!disposed) setNotice("Offline storage is unavailable in this browser. Use an updated browser with device storage enabled.");
    });
    document.addEventListener("submit", submit, true);
    window.addEventListener("offline", switchOffline);
    window.addEventListener("online", sync);
    window.addEventListener("focus", sync);
    const timer = window.setInterval(sync, 30000);
    return () => {
      disposed = true;
      document.removeEventListener("submit", submit, true);
      window.removeEventListener("offline", switchOffline);
      window.removeEventListener("online", sync);
      window.removeEventListener("focus", sync);
      window.clearInterval(timer);
    };
  }, [router, snapshot, program, returnTo, offlineUrl]);
  return <>
    {statusSlot ? createPortal(<p className="worker-sync-status" role="status">{syncStatus}</p>, statusSlot) : null}
    {notice && <p className="notice" role="status">{notice} <a href={offlineUrl}>Review saved changes</a></p>}
    {saved && <FeedbackDialog message="Record changes saved and synced." isError={false} feedbackId={saved} />}
  </>;
}
