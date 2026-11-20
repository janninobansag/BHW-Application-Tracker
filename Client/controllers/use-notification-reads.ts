"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { createNotificationReadStore } from "@/Services/notification-read-state";

// Share one store between the mobile page and navbar, including route changes.
const stores = new Map<string, ReturnType<typeof createNotificationReadStore>>();
export function useNotificationReads(userId: string) {
  const store = useMemo(() => {
    if (typeof window === "undefined") return createNotificationReadStore(userId, { fetch, storage: () => undefined });
    let existing = stores.get(userId);
    if (!existing) {
      existing = createNotificationReadStore(userId, { fetch: (...args) => fetch(...args), storage: () => window.localStorage });
      stores.set(userId, existing);
    }
    return existing;
  }, [userId]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => {
    store.start();
    const refresh = () => { if (!document.hidden) store.refresh(); };
    const storage = (event: StorageEvent) => { if (event.key === store.key) refresh(); };
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", storage);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", storage);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [store]);
  return { ...state, markRead: store.markRead };
}
