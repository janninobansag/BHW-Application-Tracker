"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check, ChevronRight } from "lucide-react";
import type { AgeNotice } from "@/Services/age-notifications";

const readEventName = "bhw-age-notifications-read";

function storedReadIds(key: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch { return []; }
}

function dateLabel(date: string, today: string) {
  if (date === today) return "Today";
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }).format(new Date(`${date}T12:00:00Z`));
}

export function AgeNotificationsPage({ userId, notices, today }: { userId: string; notices: AgeNotice[]; today: string }) {
  const storageKey = `bhw-age-notifications:${userId}`;
  const [read, setRead] = useState<string[]>([]);
  const readIds = useRef<string[]>([]);

  const markRead = useCallback((ids: string[]) => {
    const next = [...new Set([...readIds.current, ...storedReadIds(storageKey), ...ids])].sort();
    readIds.current = next;
    setRead(next);
    try {
      const saved = JSON.stringify(next);
      if (localStorage.getItem(storageKey) !== saved) localStorage.setItem(storageKey, saved);
    } catch { /* Keep read state in memory when browser storage is unavailable. */ }
    window.dispatchEvent(new CustomEvent(readEventName, { detail: { key: storageKey, ids: next } }));
  }, [storageKey]);

  useEffect(() => {
    readIds.current = storedReadIds(storageKey);
    setRead(readIds.current);
    markRead(notices.map((notice) => notice.id));
  }, [markRead, notices, storageKey]);

  return <section className="panel notification-page-panel" aria-labelledby="notification-page-title">
    <header className="notification-page-heading">
      <div>
        <p className="eyebrow">Recent updates</p>
        <h2 id="notification-page-title">Age milestones</h2>
        <p>Children who reached a new month of age in the last 7 days.</p>
      </div>
      <span className="notification-page-count">{notices.length} {notices.length === 1 ? "update" : "updates"}</span>
    </header>
    {notices.length ? <ul className="notification-page-list">
      {notices.map((notice) => <li key={notice.id}>
        <Link href={`/records/${encodeURIComponent(notice.child.id)}`} className={`notification-page-item${read.includes(notice.id) ? " is-read" : " is-unread"}`} onClick={() => markRead([notice.id])}>
          <span className="notification-page-icon" aria-hidden="true"><Bell /></span>
          <span className="notification-page-copy"><strong>{notice.child.name}</strong><span>Reached {notice.months} {notice.months === 1 ? "month" : "months"} old</span></span>
          <span className="notification-page-meta"><time dateTime={notice.date}>{dateLabel(notice.date, today)}</time><span><Check aria-hidden="true" />Read</span></span>
          <ChevronRight className="notification-page-chevron" aria-hidden="true" />
        </Link>
      </li>)}
    </ul> : <div className="notification-page-empty">
      <span className="notification-page-empty-icon"><Bell aria-hidden="true" /></span>
      <h3>You’re all caught up</h3>
      <p>Age updates for your assigned child records will appear here.</p>
    </div>}
    <footer className="notification-page-footer"><Link href="/">Back to child records</Link></footer>
  </section>;
}
