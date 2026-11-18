"use client";
import { useEffect } from "react";
import { closeWorkerAccess } from "@/public/worker-offline-store.js";
export function OfflineSession({ role }: { role: "admin" | "bhw" | "signed-out" }) {
  useEffect(() => {
    if (role !== "bhw") closeWorkerAccess();
    const signOut = (event: SubmitEvent) => {
      if (event.target instanceof HTMLFormElement && event.target.hasAttribute("data-sign-out")) closeWorkerAccess();
    };
    document.addEventListener("submit", signOut, true);
    return () => document.removeEventListener("submit", signOut, true);
  }, [role]);
  return null;
}
