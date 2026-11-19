"use client";

import type { ReactNode } from "react";
import { UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/Client/shared/components/ui/dialog";

export function CreateWorkerDialog({ children }: { children: ReactNode }) {
  return <section className="panel staff-invite-panel">
    <span className="staff-invite-icon"><UserPlus aria-hidden="true" /></span>
    <div><p className="eyebrow">Build your team</p><h2>Add a health worker</h2><p className="muted">Create an account, then assign their community coverage.</p></div>
    <Dialog><DialogTrigger asChild><button type="button" className="primary-button"><UserPlus aria-hidden="true" />Create BHW account</button></DialogTrigger>
      <DialogContent className="create-worker-dialog"><DialogHeader><p className="eyebrow">Staff access</p><DialogTitle>Create BHW account</DialogTitle><DialogDescription>The worker will choose a new password at first sign-in. All fields are required.</DialogDescription></DialogHeader>{children}</DialogContent>
    </Dialog>
  </section>;
}
