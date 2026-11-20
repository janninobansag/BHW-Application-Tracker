import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardList, MapPin, Ruler, Scale } from "lucide-react";
import type { Barangay, Child, Purok, TimbangRecord } from "@/Data/entities";
import { ageInMonths } from "@/Services/child-records";

function missingMeasurements(record: TimbangRecord): string[] {
  return ([['weight', 'Weight'], ['height', 'Height'], ['muac', 'MUAC']] as const)
    .filter(([key]) => typeof record[key] !== "number" || !Number.isFinite(record[key]) || record[key]! <= 0)
    .map(([, label]) => label);
}

function RegistryOverview({ program, records, today }: { program: "deworming" | "timbang"; records: Child[]; today: string }) {
  const timbang = program === "timbang";
  const href = timbang ? "/operation-timbang" : "/";
  const eligible = records.filter((record) => {
    const months = ageInMonths(record.birthday, today);
    return timbang ? months >= 0 && months <= 72 : months >= 6 && months <= 59;
  }).length;
  const male = records.filter((record) => record.sex === "M").length;
  const female = records.filter((record) => record.sex === "F").length;
  const Icon = timbang ? Scale : ClipboardList;
  return <article className="dashboard-registry">
    <div className="dashboard-registry-heading"><span className="dashboard-program-icon"><Icon aria-hidden="true" /></span><div><p className="eyebrow">{timbang ? "Growth monitoring" : "Child health registry"}</p><h2>{timbang ? "Operation Timbang" : "Vitamin A & Deworming"}</h2></div></div>
    <div className="dashboard-record-count"><strong>{records.length}</strong><span>assigned {records.length === 1 ? "record" : "records"}</span></div>
    <dl className="dashboard-sex-totals"><div><dt>Male</dt><dd>{male}</dd></div><div><dt>Female</dt><dd>{female}</dd></div></dl>
    <p className="dashboard-age-summary"><strong>{eligible}</strong> aged {timbang ? "0–72" : "6–59"} full months</p>
    <Link href={href} className="dashboard-registry-link"><span>Open {timbang ? "Operation Timbang" : "child registry"}</span><ArrowRight aria-hidden="true" /></Link>
  </article>;
}

export function WorkerDashboard({ childrenRecords, timbangRecords, barangays, puroks, today }: {
  childrenRecords: Child[]; timbangRecords: TimbangRecord[]; barangays: Barangay[]; puroks: Purok[]; today: string;
}) {
  const incomplete = timbangRecords.filter((record) => missingMeasurements(record).length > 0);
  return <div className="worker-dashboard">
    <section className="dashboard-registries" aria-label="Your registries">
      <RegistryOverview program="deworming" records={childrenRecords} today={today} />
      <RegistryOverview program="timbang" records={timbangRecords} today={today} />
    </section>
    <div className="dashboard-detail-grid">
      <section className="dashboard-section" aria-labelledby="dashboard-measurements-title">
        <header><div><p className="eyebrow">Operation Timbang</p><h2 id="dashboard-measurements-title">Measurements to complete</h2></div><span className="dashboard-section-count">{incomplete.length}</span></header>
        {incomplete.length ? <>
          <p className="dashboard-section-description">These records are missing one or more measurements.</p>
          <ul className="dashboard-review-list">{incomplete.slice(0, 4).map((record) => <li key={record.id}><Link href={`/operation-timbang/${encodeURIComponent(record.id)}`}>
            <span className="dashboard-review-icon"><Ruler aria-hidden="true" /></span><span className="dashboard-review-copy"><strong>{record.name}</strong><small>Missing: {missingMeasurements(record).join(", ")}</small></span><ArrowRight aria-hidden="true" />
          </Link></li>)}</ul>
          <footer><Link href="/operation-timbang">View all Operation Timbang records<ArrowRight aria-hidden="true" /></Link></footer>
        </> : <div className="dashboard-section-empty"><CheckCircle2 aria-hidden="true" /><h3>{timbangRecords.length ? "Measurements are complete" : "Ready for your first measurement"}</h3><p>{timbangRecords.length ? "All assigned Operation Timbang records have weight, height, and MUAC recorded." : "Open Operation Timbang to add a child and record their measurements."}</p><Link href="/operation-timbang">Open Operation Timbang<ArrowRight aria-hidden="true" /></Link></div>}
      </section>
      <section className="dashboard-section" aria-labelledby="dashboard-coverage-title">
        <header><div><p className="eyebrow">Your coverage</p><h2 id="dashboard-coverage-title">Assigned communities</h2></div><MapPin aria-hidden="true" /></header>
        {barangays.length ? <><p className="dashboard-section-description">Select a Purok to open its child registry.</p><ul className="dashboard-coverage-list">{barangays.slice(0, 3).map((barangay) => {
          const assignedPuroks = puroks.filter((purok) => purok.barangay_id === barangay.id);
          return <li key={barangay.id}><div><strong>{barangay.name}</strong><span>{assignedPuroks.length} {assignedPuroks.length === 1 ? "Purok" : "Puroks"}</span></div><ul>{assignedPuroks.slice(0, 4).map((purok) => <li key={purok.id}><Link href={`/?barangay=${encodeURIComponent(barangay.id)}&purok=${encodeURIComponent(purok.id)}`}>{purok.name}<ArrowRight aria-hidden="true" /></Link></li>)}</ul>{assignedPuroks.length > 4 && <p className="dashboard-more-coverage">+{assignedPuroks.length - 4} more assigned Puroks</p>}</li>;
        })}</ul>{barangays.length > 3 && <p className="dashboard-more-coverage">+{barangays.length - 3} more assigned barangays. All assignments are available in the registry filters.</p>}</> : <div className="dashboard-section-empty"><MapPin aria-hidden="true" /><h3>No communities assigned yet</h3><p>Ask your administrator to assign your Barangay and Purok before adding child records.</p></div>}
      </section>
    </div>
  </div>;
}

export function DashboardUnavailable() {
  return <section className="panel dashboard-unavailable"><h2>Unable to load your overview</h2><p>Your records could not be loaded right now. Try the dashboard again, or open a registry.</p><div><a className="primary-button" href="/dashboard">Try again</a><Link className="secondary-button" href="/">Child registry</Link><Link className="secondary-button" href="/operation-timbang">Operation Timbang</Link></div></section>;
}
