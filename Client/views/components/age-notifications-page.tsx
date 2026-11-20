"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Bell, Check, ChevronRight } from "lucide-react";
import type { AgeNotice } from "@/Services/age-notifications";
import { useNotificationReads } from "@/Client/controllers/use-notification-reads";

function dateLabel(date: string, today: string) {
  if (date === today) return "Today";
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }).format(new Date(`${date}T12:00:00Z`));
}

export function AgeNotificationsPage({ userId, notices, today }: { userId: string; notices: AgeNotice[]; today: string }) {
  const { readIds: read, loaded, error, markRead } = useNotificationReads(userId);

  useEffect(() => {
    const markVisible = () => { if (!document.hidden) markRead(notices.map((notice) => notice.id)); };
    markVisible();
    document.addEventListener("visibilitychange", markVisible);
    return () => document.removeEventListener("visibilitychange", markVisible);
  }, [markRead, notices]);

  return <section className="panel notification-page-panel" aria-labelledby="notification-page-title">
    <header className="notification-page-heading">
      <div>
        <p className="eyebrow">Recent updates</p>
        <h2 id="notification-page-title">Age milestones</h2>
        <p>Children who reached a new month of age in the last 7 days.</p>
      </div>
      <span className="notification-page-count">{notices.length} {notices.length === 1 ? "update" : "updates"}</span>
    </header>
    {error && <p role="status">{error}</p>}
    {notices.length ? <ul className="notification-page-list">
      {notices.map((notice) => <li key={notice.id}>
        <Link href={`/records/${encodeURIComponent(notice.child.id)}`} className={`notification-page-item${read.includes(notice.id) ? " is-read" : loaded ? " is-unread" : ""}`} onClick={() => markRead([notice.id])}>
          <span className="notification-page-icon" aria-hidden="true"><Bell /></span>
          <span className="notification-page-copy"><strong>{notice.child.name}</strong><span>Reached {notice.months} {notice.months === 1 ? "month" : "months"} old</span></span>
          <span className="notification-page-meta"><time dateTime={notice.date}>{dateLabel(notice.date, today)}</time>{read.includes(notice.id) && <span><Check aria-hidden="true" />Read</span>}</span>
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
