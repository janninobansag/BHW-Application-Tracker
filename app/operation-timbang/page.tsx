import { requireUser } from "@/Services/auth";
import { AppShell } from "@/Client/views/components/shell";

export const dynamic = "force-dynamic";

export default async function OperationTimbangPage() {
  const user = await requireUser();
  return <AppShell user={user} title="Operation Timbang" eyebrow="Workspace">
    <p className="panel workspace-coming-soon">Coming soon</p>
  </AppShell>;
}
