"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, ContactRound, LayoutDashboard, Scale, Settings } from "lucide-react";
import type { AppUser } from "@/Data/entities";
import { Popover, PopoverContent, PopoverTrigger } from "@/Client/shared/components/ui/popover";
import { useState } from "react";

export function MobileNavigation({ user }: { user: AppUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return <div className="mobile-header-links"><Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><button type="button" className="mobile-workspace-trigger" aria-label="Open workspace navigation" title="Workspace navigation"><ClipboardList aria-hidden="true" /></button></PopoverTrigger>
    <PopoverContent align="end" sideOffset={10} collisionPadding={12} className="mobile-workspace-popover">
      <nav aria-label="Workspace navigation">
        <Link href="/dashboard" onClick={() => setOpen(false)} aria-current={pathname === "/dashboard" ? "page" : undefined}><LayoutDashboard aria-hidden="true" /><span>Dashboard</span></Link>
        <Link href="/" onClick={() => setOpen(false)} aria-current={pathname === "/" || pathname.startsWith("/records/") ? "page" : undefined}><ClipboardList aria-hidden="true" /><span>Vitamin A &amp; Deworming</span></Link>
        <Link href="/worker-portfolio" onClick={() => setOpen(false)} aria-current={pathname === "/worker-portfolio" ? "page" : undefined}><ContactRound aria-hidden="true" /><span>Health Worker Portfolio Summary</span></Link>
        <Link href="/operation-timbang" onClick={() => setOpen(false)} aria-current={pathname === "/operation-timbang" ? "page" : undefined}><Scale aria-hidden="true" /><span>Operation Timbang</span></Link>
        {user.role === "admin" && <Link href="/admin" onClick={() => setOpen(false)} aria-current={pathname === "/admin" ? "page" : undefined}><Settings aria-hidden="true" /><span>Administration</span></Link>}
      </nav>
    </PopoverContent>
  </Popover></div>;
}
