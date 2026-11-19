import { requireUser } from "@/Services/auth";
import { AppShell } from "@/Client/views/components/shell";

export default async function WorkerPortfolioPage() {
  const user = await requireUser();
  return <AppShell user={user} title="Health Worker Portfolio Summary" eyebrow="Worker portfolio" contentClassName="worker-portfolio-page">
    <p className="panel workspace-coming-soon">Coming soon</p>
  </AppShell>;
}
