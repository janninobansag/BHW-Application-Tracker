"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, ContactRound, UsersRound } from "lucide-react";

export function SidebarNavigation({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return <nav aria-label="Main navigation" className="side-nav">
    <span className="side-nav-label">Workspace</span>
    <Link href="/" aria-current={pathname === "/" || pathname.startsWith("/records/") ? "page" : undefined}><ClipboardList aria-hidden="true" /><span>Vitamin A & Deworming</span></Link>
    <Link href="/worker-portfolio" aria-current={pathname === "/worker-portfolio" ? "page" : undefined}><ContactRound aria-hidden="true" /><span>Health Worker Portfolio Summary</span></Link>
    {isAdmin && <Link href="/admin" aria-current={pathname === "/admin" ? "page" : undefined}><UsersRound aria-hidden="true" /><span>Administration</span></Link>}
  </nav>;
}
