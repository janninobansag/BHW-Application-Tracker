import Link from "next/link";
import { ArrowRight, ClipboardList, Scale } from "lucide-react";
import type { Barangay, Child, ManagedUser, Purok, Sitio, TimbangRecord } from "@/Data/entities";
import { summarizeAdminDashboard } from "@/Services/admin-dashboard";

export function AdminDashboard({ users, barangays, puroks, sitios, childRecords, timbang }: {
  users: ManagedUser[]; barangays: Barangay[]; puroks: Purok[]; sitios: Sitio[]; childRecords: Child[]; timbang: TimbangRecord[];
}) {
  const summary = summarizeAdminDashboard({ users, barangays, puroks, children: childRecords, timbang });
  const attention = [
    { label: "Workers without a Purok", detail: "Active accounts only", count: summary.unassignedWorkers, href: "/admin?status=unassigned" },
    { label: "Puroks without an active worker", detail: "", count: summary.uncoveredPuroks, href: "/admin" },
    { label: "Incomplete measurements", detail: "Operation Timbang", count: summary.incompleteMeasurements, href: "/operation-timbang" },
  ].filter((item) => item.count > 0);
  return <div className="admin-dashboard">
    <dl className="admin-dashboard-totals" aria-label="Team and coverage totals">
      <div><dt>Active workers</dt><dd>{summary.activeWorkers}</dd><small>{summary.inactiveWorkers ? `${summary.inactiveWorkers} inactive` : `${users.length} accounts`}</small></div>
      <div><dt>Barangays</dt><dd>{barangays.length}</dd></div>
      <div><dt>Puroks</dt><dd>{puroks.length}</dd></div>
      <div><dt>Sitios</dt><dd>{sitios.length}</dd></div>
    </dl>
    <section className="admin-registry-summary" aria-labelledby="admin-records-heading">
      <header><h2 id="admin-records-heading">Registries</h2></header>
      {([{ href: "/", label: "Vitamin A & Deworming", records: childRecords, Icon: ClipboardList }, { href: "/operation-timbang", label: "Operation Timbang", records: timbang, Icon: Scale }]).map(({ href, label, records, Icon }) => <div className="admin-registry-row" key={href}>
        <span className="admin-registry-name"><Icon aria-hidden="true" /><strong>{label}</strong></span>
        <span className="admin-registry-count"><strong>{records.length}</strong> {records.length === 1 ? "record" : "records"}</span>
        <span className="admin-registry-sex"><span>{records.filter((record) => record.sex === "M").length} male</span><span>{records.filter((record) => record.sex === "F").length} female</span></span>
        <Link href={href} aria-label={`Open ${label}`}>Open registry<ArrowRight aria-hidden="true" /></Link>
      </div>)}
    </section>
    <div className="admin-dashboard-grid">
      <section className="dashboard-section admin-coverage-section" aria-labelledby="admin-coverage-heading">
        <header><h2 id="admin-coverage-heading">Barangay coverage</h2><Link href="/admin" className="admin-dashboard-text-link">Manage coverage<ArrowRight aria-hidden="true" /></Link></header>
        {summary.coverage.length ? <>
          <div className="admin-coverage-table-wrap" role="region" aria-label="Records and active workers by barangay" tabIndex={0}>
            <table className="admin-coverage-table"><caption className="sr-only">Registry records and active BHWs by barangay</caption>
              <thead><tr><th scope="col">Barangay</th><th scope="col">Active BHWs</th><th scope="col">Vitamin A &amp; Deworming</th><th scope="col">Timbang</th></tr></thead>
              <tbody>{summary.coverage.slice(0, 6).map((row) => <tr key={row.id}>
                <th scope="row"><Link href={`/?barangay=${encodeURIComponent(row.id)}`}>{row.name}</Link><small>{row.puroks} {row.puroks === 1 ? "Purok" : "Puroks"}</small></th>
                <td data-label="Active BHWs">{row.workers}</td><td data-label="Vitamin A & Deworming">{row.children}</td><td data-label="Timbang">{row.timbang}</td>
              </tr>)}</tbody>
            </table>
          </div>
          {summary.coverage.length > 6 && <footer><span className="admin-dashboard-table-note">Showing 6 of {summary.coverage.length} barangays.</span><Link href="/admin">View all coverage<ArrowRight aria-hidden="true" /></Link></footer>}
        </> : <div className="dashboard-section-empty"><h3>No barangays added</h3><p>Add your Barangays, Puroks, and Sitios in Administration.</p><Link href="/admin">Set up coverage<ArrowRight aria-hidden="true" /></Link></div>}
      </section>
      <section className="dashboard-section admin-attention-section" aria-labelledby="admin-attention-heading">
        <header><h2 id="admin-attention-heading">Needs attention</h2></header>
        {attention.length ? <ul className="admin-attention-list">{attention.map((item) => <li key={item.label}><Link href={item.href}><span><strong>{item.label}</strong>{item.detail && <small>{item.detail}</small>}</span><span className="admin-attention-count">{item.count}</span><ArrowRight aria-hidden="true" /></Link></li>)}</ul> : <div className="dashboard-section-empty"><h3>No outstanding items</h3><p>There are no assignment or measurement gaps to review.</p></div>}
        <footer><Link href="/admin">Manage worker accounts<ArrowRight aria-hidden="true" /></Link></footer>
      </section>
    </div>
  </div>;
}
