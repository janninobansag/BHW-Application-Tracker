"use client";
import { useEffect } from "react";
import { activeWorkerId, closeWorkerAccess } from "@/public/worker-offline-store.js";
export function OfflineSession({ role, userId }: { role: "admin" | "bhw" | "signed-out"; userId?: string }) {
  useEffect(() => {
    if (role !== "bhw") closeWorkerAccess();
    else if (userId) {
      try { if (activeWorkerId() && activeWorkerId() !== userId) closeWorkerAccess(); } catch { /* Online access still works with blocked browser storage. */ }
    }
    const signOut = (event: SubmitEvent) => {
      if (event.target instanceof HTMLFormElement && event.target.hasAttribute("data-sign-out")) closeWorkerAccess();
    };
    document.addEventListener("submit", signOut, true);
    const requireConnection = () => { if (role === "admin") window.location.replace("/online-required.html"); };
    window.addEventListener("offline", requireConnection);
    if (!navigator.onLine) requireConnection();
    return () => { document.removeEventListener("submit", signOut, true); window.removeEventListener("offline", requireConnection); };
  }, [role, userId]);
  return null;
}
