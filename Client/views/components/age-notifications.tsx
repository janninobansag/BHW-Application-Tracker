"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, ChevronRight } from "lucide-react";
import type { AppUser, Child } from "@/Data/entities";
import { ageInMonths, isValidBirthday, todayInManila } from "@/Services/child-records";
import { Popover, PopoverContent, PopoverTrigger } from "@/Client/shared/components/ui/popover";

type AgeNotice = { id: string; child: Child; date: string; months: number };

function daysBefore(today: string, days: number) {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function recentAgeChanges(children: Child[], today: string): AgeNotice[] {
  const notices: AgeNotice[] = [];
  for (let day = 0; day < 7; day++) {
    const date = daysBefore(today, day);
    const before = daysBefore(date, 1);
    for (const child of children) {
      if (!isValidBirthday(child.birthday, before)) continue;
      const months = ageInMonths(child.birthday, date);
      if (months > ageInMonths(child.birthday, before)) notices.push({ id: `${child.id}:${date}`, child, date, months });
    }
  }
  return notices;
}

export function AgeNotifications({ user }: { user: AppUser }) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [today, setToday] = useState("");
  const [read, setRead] = useState<string[]>([]);
  const [status, setStatus] = useState("Loading age updates...");
  const storageKey = `bhw-age-notifications:${user.id}`;
  const notices = useMemo(() => today ? recentAgeChanges(children, today) : [], [children, today]);
  const unread = notices.filter((notice) => !read.includes(notice.id)).length;

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
          try {
            const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
            if (Array.isArray(saved)) setRead(saved.filter((id): id is string => typeof id === "string"));
          } catch { /* The menu still works when browser storage is unavailable. */ }
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

  function markRead(ids: string[]) {
    const next = [...new Set([...read, ...ids])].filter((id) => notices.some((notice) => notice.id === id));
    setRead(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Read state lasts for this visit. */ }
  }

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><button type="button" className="notification-trigger" aria-label={`Age notifications${unread ? `, ${unread} unread` : ""}`}><Bell aria-hidden="true" />{unread > 0 && <span className="notification-badge" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}</button></PopoverTrigger>
    <PopoverContent align="end" sideOffset={10} collisionPadding={12} className="notification-panel">
      <div className="notification-heading"><div><h2>Notifications</h2><p>Monthly age changes in the last 7 days</p></div>{unread > 0 && <button type="button" className="notification-read" onClick={() => markRead(notices.map((notice) => notice.id))} aria-label="Mark all notifications as read" title="Mark all as read"><CheckCheck aria-hidden="true" /></button>}</div>
      {status ? <p className="notification-empty" role="status">{status}</p> : notices.length ? <ul className="notification-list">{notices.map((notice) => <li key={notice.id}><Link href={`/records/${encodeURIComponent(notice.child.id)}`} className={`notification-item${read.includes(notice.id) ? "" : " is-unread"}`} onClick={() => { markRead([notice.id]); setOpen(false); }}><span className="notification-dot" aria-hidden="true" /><span><strong>{notice.child.name}</strong><span>Reached {notice.months} {notice.months === 1 ? "month" : "months"} old</span><small>{notice.date === today ? "Today" : new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" }).format(new Date(`${notice.date}T12:00:00Z`))}</small></span><ChevronRight aria-hidden="true" /></Link></li>)}</ul> : <div className="notification-empty"><Bell aria-hidden="true" /><strong>No recent age changes</strong><p>Age updates for your accessible records will appear here.</p></div>}
    </PopoverContent>
  </Popover>;
}
