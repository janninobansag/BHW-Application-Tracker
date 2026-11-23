import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { requireAdmin } from "@/Services/auth";
import { getWorkerRecords } from "@/Data/repositories";
import { AppShell } from "@/Client/views/components/shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Worker activity | BHW Records" };

type Program = "all" | "deworming" | "timbang";

export default async function WorkerActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ program?: string; page?: string }>;
}) {
  const admin = await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const program: Program = query.program === "deworming" || query.program === "timbang" ? query.program : "all";
  const requestedPage = Number(query.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const activity = await getWorkerRecords(id, program, page);
  if (!activity) notFound();

  const pageHref = (nextProgram: Program, nextPage = 1) => `/admin/workers/${encodeURIComponent(id)}?program=${nextProgram}&page=${nextPage}`;
  const dateFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });
  const programOptions: Array<{ id: Program; label: string; count: number }> = [
    { id: "all", label: "All records", count: activity.counts.total },
    { id: "deworming", label: "Vitamin A & Deworming", count: activity.counts.deworming },
    { id: "timbang", label: "Operation Timbang", count: activity.counts.timbang },
  ];

  return <AppShell user={admin} title="Worker activity" eyebrow="">
    <Link href="/admin" className="worker-activity-back"><ArrowLeft aria-hidden="true" />Back to BHW accounts</Link>
    <section className="panel worker-activity-panel" aria-labelledby="worker-activity-heading">
      <header className="worker-activity-heading">
        <div><p className="eyebrow">Records added by</p><h2 id="worker-activity-heading">{activity.worker.display_name}</h2><p>@{activity.worker.username} <span aria-hidden="true">·</span> {activity.worker.is_active ? "Active account" : "Inactive account"}</p></div>
        <div className="worker-activity-total"><strong>{activity.counts.total}</strong><span>{activity.counts.total === 1 ? "record added" : "records added"}</span></div>
      </header>
      <nav className="worker-activity-filters" aria-label="Record program">
        {programOptions.map((option) => <Link key={option.id} href={pageHref(option.id)} aria-current={program === option.id ? "page" : undefined}>{option.label}<span>{option.count}</span></Link>)}
      </nav>
      {activity.records.length ? <>
        <div className="worker-activity-table-wrap" role="region" aria-labelledby="worker-activity-heading" tabIndex={0}>
          <table className="worker-activity-table"><caption className="sr-only">Records added by {activity.worker.display_name}</caption>
            <thead><tr><th scope="col">Child</th><th scope="col">Registry</th><th scope="col">Barangay and Purok</th><th scope="col">Saved to database</th></tr></thead>
            <tbody>{activity.records.map((record) => <tr key={`${record.program}:${record.id}`}>
              <th scope="row"><Link href={record.program === "timbang" ? `/operation-timbang/${encodeURIComponent(record.id)}` : `/records/${encodeURIComponent(record.id)}`}>{record.name}<ArrowRight aria-hidden="true" /></Link></th>
              <td data-label="Registry">{record.program === "timbang" ? "Operation Timbang" : "Vitamin A & Deworming"}</td>
              <td data-label="Barangay and Purok">{record.barangay_name}<small>{record.purok_name}</small></td>
              <td data-label="Saved to database"><time dateTime={record.created_at}>{dateFormat.format(new Date(record.created_at))}</time></td>
            </tr>)}</tbody>
          </table>
        </div>
        <nav className="worker-activity-pagination" aria-label="Worker record pages">
          <span>Showing {(activity.page - 1) * 10 + 1}–{Math.min(activity.page * 10, activity.filteredTotal)} of {activity.filteredTotal} · Page {activity.page} of {activity.pageCount}</span>
          <div>{activity.page > 1 && <Link href={pageHref(program, activity.page - 1)}>Previous</Link>}{activity.page < activity.pageCount && <Link href={pageHref(program, activity.page + 1)}>Next</Link>}</div>
        </nav>
      </> : <div className="worker-activity-empty"><strong>No records added</strong><p>{activity.counts.total ? "This worker has no records in the selected registry." : "Records created by this worker will appear here."}</p></div>}
      <p className="worker-activity-note">Offline entries appear after they sync. The date shown is when each record reached the database. Deleted records are no longer listed.</p>
    </section>
  </AppShell>;
}
