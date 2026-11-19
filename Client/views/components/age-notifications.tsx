"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, ChevronRight } from "lucide-react";
import type { AppUser, Child } from "@/Data/entities";
import { todayInManila } from "@/Services/child-records";
import { recentAgeChanges } from "@/Services/age-notifications";
import { Popover, PopoverContent, PopoverTrigger } from "@/Client/shared/components/ui/popover";

const readEventName = "bhw-age-notifications-read";

function storedReadIds(key: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch { return []; }
}

export function AgeNotifications({ user }: { user: AppUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [today, setToday] = useState("");
  const [read, setRead] = useState<string[]>([]);
  const readIds = useRef<string[]>([]);
  const [status, setStatus] = useState("Loading age updates...");
  const storageKey = `bhw-age-notifications:${user.id}`;
  const notices = useMemo(() => today ? recentAgeChanges(children, today) : [], [children, today]);
  const unread = notices.filter((notice) => !read.includes(notice.id)).length;

  const markRead = useCallback((ids: string[]) => {
    // Merge against current storage as well as this tab; never replace another tab's receipts.
    // Keep older IDs when coverage or the seven-day window changes.
    const next = [...new Set([...readIds.current, ...storedReadIds(storageKey), ...ids])].sort();
    readIds.current = next;
    setRead(next);
    try {
      const saved = JSON.stringify(next);
      if (localStorage.getItem(storageKey) !== saved) localStorage.setItem(storageKey, saved);
    } catch { /* Preserve read state in memory when browser storage is unavailable. */ }
  }, [storageKey]);

  useEffect(() => {
    markRead([]);
    const receiveRead = (event: StorageEvent) => {
      if (event.key !== storageKey || !event.newValue) return;
      try {
        const incoming: unknown = JSON.parse(event.newValue);
        if (Array.isArray(incoming)) markRead(incoming.filter((id): id is string => typeof id === "string"));
      } catch { /* Ignore an invalid storage value and retain this tab's receipts. */ }
    };
    const receiveSameTabRead = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string; ids?: string[] }>).detail;
      if (detail?.key === storageKey && Array.isArray(detail.ids)) markRead(detail.ids);
    };
    window.addEventListener("storage", receiveRead);
    window.addEventListener(readEventName, receiveSameTabRead);
    return () => {
      window.removeEventListener("storage", receiveRead);
      window.removeEventListener(readEventName, receiveSameTabRead);
    };
  }, [markRead, storageKey]);

  useEffect(() => {
    if (open && notices.length) markRead(notices.map((notice) => notice.id));
  }, [markRead, notices, open]);

  useEffect(() => {
    let disposed = false;
    let busy = false;
    const controller = new AbortController();
    async function refresh() {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const options = { cache: "no-store" as const, signal: controller.signal };
        const sessionResponse = await fetch("/api/backend/auth/me", options);
        if (!sessionResponse.ok) throw new Error("Sign in again to view age updates.");
        const session = await sessionResponse.json();
        if (session.user?.id !== user.id) throw new Error("Sign in again to view age updates.");
        const response = await fetch("/api/backend/children", options);
        if (!response.ok) throw new Error("Could not load age updates. Please try again.");
        const data = await response.json();
        if (!Array.isArray(data.children)) throw new Error("Could not load age updates. Please try again.");
        if (!disposed) {
          setChildren(data.children); setToday(todayInManila()); setStatus("");
        }
      } catch (error) {
        if (!disposed) { setChildren([]); setStatus(navigator.onLine ? error instanceof Error ? error.message : "Could not load age updates." : "Connect to the internet to view age updates."); }
      } finally { busy = false; }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60000);
    const onRefresh = () => void refresh();
    window.addEventListener("focus", onRefresh);
    window.addEventListener("online", onRefresh);
    document.addEventListener("visibilitychange", onRefresh);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener("online", onRefresh);
      document.removeEventListener("visibilitychange", onRefresh);
    };
  }, [storageKey, user.id]);

  const label = `Age notifications${unread ? `, ${unread} unread` : ""}`;
  return <>
    <Link href="/notifications" className="notification-mobile-link" aria-label={label} aria-current={pathname === "/notifications" ? "page" : undefined}>
      <Bell aria-hidden="true" />
      {unread > 0 && <span className="notification-badge" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
    </Link>
    <div className="notification-desktop-control">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild><button type="button" className="notification-trigger" aria-label={label}><Bell aria-hidden="true" />{unread > 0 && <span className="notification-badge" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}</button></PopoverTrigger>
        <PopoverContent align="end" sideOffset={10} collisionPadding={12} className="notification-panel">
          <div className="notification-heading"><div><h2>Notifications</h2><p>Monthly age changes in the last 7 days</p></div>{unread > 0 && <button type="button" className="notification-read" onClick={() => markRead(notices.map((notice) => notice.id))} aria-label="Mark all notifications as read" title="Mark all as read"><CheckCheck aria-hidden="true" /></button>}</div>
          {status ? <p className="notification-empty" role="status">{status}</p> : notices.length ? <ul className="notification-list">{notices.map((notice) => <li key={notice.id}><Link href={`/records/${encodeURIComponent(notice.child.id)}`} className={`notification-item${read.includes(notice.id) ? "" : " is-unread"}`} onClick={() => { markRead([notice.id]); setOpen(false); }}><span className="notification-dot" aria-hidden="true" /><span><strong>{notice.child.name}</strong><span>Reached {notice.months} {notice.months === 1 ? "month" : "months"} old</span><small>{notice.date === today ? "Today" : new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" }).format(new Date(`${notice.date}T12:00:00Z`))}</small></span><ChevronRight aria-hidden="true" /></Link></li>)}</ul> : <div className="notification-empty"><Bell aria-hidden="true" /><strong>No recent age changes</strong><p>Age updates for your accessible records will appear here.</p></div>}
        </PopoverContent>
      </Popover>
    </div>
  </>;
}
