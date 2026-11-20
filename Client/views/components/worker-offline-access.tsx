"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { prepareWorkerWorkspace, readWorkerContents, syncAllWorkerChanges } from "@/public/worker-offline-store.js";
import { workerOfflineUrl } from "@/public/offline-routing.js";

export function WorkerOfflineAccess({ userId }: { userId: string }) {
  const pathname = usePathname();
  useEffect(() => {
    let disposed = false;
    let busy = false;
    let prepared = false;
    const refresh = async () => {
      if (busy || disposed || !navigator.onLine || document.hidden) return;
      busy = true;
      try {
        if (!prepared) { await prepareWorkerWorkspace(userId, () => !disposed); prepared = true; }
        const copies = await Promise.all([readWorkerContents(), readWorkerContents("timbang")]);
        if (copies.some((copy) => copy?.pending.length)) await syncAllWorkerChanges();
      } catch { /* Registry controls keep their existing local-save and retry feedback. */ }
      finally { busy = false; }
    };
    const navigateOffline = (event: MouseEvent) => {
      if (navigator.onLine || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target || anchor.download || anchor.origin !== location.origin) return;
      const target = workerOfflineUrl(new URL(anchor.href));
      if (target) { event.preventDefault(); event.stopImmediatePropagation(); location.assign(target); }
    };
    const disconnected = () => {
      // Registry pages save any open form before switching themselves.
      if (pathname === "/" || pathname.startsWith("/records/") || pathname.startsWith("/operation-timbang")) return;
      const target = workerOfflineUrl(new URL(location.href));
      if (target) location.replace(target);
    };
    void refresh();
    if (!navigator.onLine) disconnected();
    const timer = window.setInterval(() => void refresh(), 30000);
    const connected = () => { prepared = false; void refresh(); };
    document.addEventListener("click", navigateOffline, true);
    window.addEventListener("offline", disconnected);
    window.addEventListener("online", connected);
    window.addEventListener("focus", refresh);
    return () => { disposed = true; clearInterval(timer); document.removeEventListener("click", navigateOffline, true); window.removeEventListener("offline", disconnected); window.removeEventListener("online", connected); window.removeEventListener("focus", refresh); };
  }, [userId, pathname]);
  return null;
}
