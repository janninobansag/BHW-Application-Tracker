import { requireUser } from "@/Services/auth";
import { listChildren } from "@/Data/repositories";
import { todayInManila } from "@/Services/child-records";
import { recentAgeChanges } from "@/Services/age-notifications";
import { AgeNotificationsPage } from "@/Client/views/components/age-notifications-page";
import { AppShell } from "@/Client/views/components/shell";

export default async function NotificationsPage() {
  const user = await requireUser();
  const children = await listChildren(user);
  const today = todayInManila();
  const notices = recentAgeChanges(children, today);

  return <AppShell user={user} title="Notifications" eyebrow="Age updates">
    <AgeNotificationsPage userId={user.id} notices={notices} today={today} />
  </AppShell>;
}
