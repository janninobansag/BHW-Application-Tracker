"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Settings } from "lucide-react";
import type { AppUser } from "@/Data/entities";

export function MobileNavigation({ user }: { user: AppUser }) {
  const pathname = usePathname();
  return <nav className="mobile-header-links" aria-label="Quick navigation">
    <Link href="/" aria-label="Child records" title="Child records" aria-current={pathname === "/" || pathname.startsWith("/records/") ? "page" : undefined}><ClipboardList aria-hidden="true" /></Link>
    {user.role === "admin" && <Link href="/admin" aria-label="Administration" title="Administration" aria-current={pathname === "/admin" ? "page" : undefined}><Settings aria-hidden="true" /></Link>}
  </nav>;
}
