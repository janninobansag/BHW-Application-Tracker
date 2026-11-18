"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { ChevronDown, ChevronRight, LogOut, Settings, UserRound } from "lucide-react";
import type { AppUser } from "@/Data/entities";
import { logout } from "@/Client/controllers/actions";
import { PwaInstallButton } from "@/Client/views/components/pwa-install-button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/Client/shared/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/Client/shared/components/ui/dialog";
import { AccountIdentity, AccountSettings } from "@/Client/views/components/account-settings";

function SignOutMenuItem() {
  const { pending } = useFormStatus();
  return <DropdownMenuItem asChild className="profile-menu-item profile-menu-signout" disabled={pending} onSelect={(event) => event.preventDefault()}><button type="submit" disabled={pending} aria-busy={pending}><LogOut aria-hidden="true" />{pending ? "Signing out..." : "Sign out"}</button></DropdownMenuItem>;
}

export function ProfileMenu({ user }: { user: AppUser }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  return <><div className="profile-menu"><DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild><button type="button" className="profile-menu-trigger" aria-label="Open profile menu"><span className="profile-menu-avatar" aria-hidden="true"><UserRound /></span><span className="profile-menu-chevron" aria-hidden="true"><ChevronDown /></span></button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" sideOffset={8} className="profile-menu-content">
      <AccountIdentity user={user} />
      <p className="profile-menu-section-label">Account</p>
      <DropdownMenuItem className="profile-menu-item" onSelect={() => setSettingsOpen(true)}><Settings aria-hidden="true" /><span>Settings</span><ChevronRight className="profile-menu-arrow" aria-hidden="true" /></DropdownMenuItem>
      <div className="profile-menu-install"><PwaInstallButton /></div>
      <form action={logout} data-sign-out className="profile-menu-signout-form"><SignOutMenuItem /></form>
    </DropdownMenuContent>
  </DropdownMenu></div><Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent className="account-settings-dialog"><DialogHeader><DialogTitle>Settings</DialogTitle><DialogDescription>Manage your account and security.</DialogDescription></DialogHeader><AccountSettings user={user} onNavigate={() => setSettingsOpen(false)} /></DialogContent></Dialog></>;
}
