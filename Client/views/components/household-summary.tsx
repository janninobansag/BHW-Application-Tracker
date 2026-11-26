"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, FileDown } from "lucide-react";
import type { Barangay, HouseholdProfile, Purok, Sitio } from "@/Data/entities";
import { buildHouseholdSummary, summarySectionGroups } from "@/public/household-summary.js";

const todayInManila = () => { const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); const value = (type: string) => parts.find((part) => part.type === type)?.value ?? ""; return `${value("year")}-${value("month")}-${value("day")}`; };
const quarterNames = ["First quarter", "Second quarter", "Third quarter", "Fourth quarter"];

export function HouseholdSummary({ profiles, barangays, puroks, sitios, workerName }: { profiles: HouseholdProfile[]; barangays: Barangay[]; puroks: Purok[]; sitios: Sitio[]; workerName: string }) {
  const [barangayId, setBarangayId] = useState("");
  const [purokId, setPurokId] = useState("");
  const [sitioId, setSitioId] = useState("");
  const [year, setYear] = useState("");
  const [quarter, setQuarter] = useState("");
  const [showZeros, setShowZeros] = useState(false);
  const years = useMemo(() => [...new Set(profiles.flatMap((profile) => profile.visits.filter(Boolean).map((date) => date.slice(0, 4))))].sort().reverse(), [profiles]);
  const summary = useMemo(() => buildHouseholdSummary(profiles, { barangayId, purokId, sitioId, year, quarter, today: todayInManila() }), [profiles, barangayId, purokId, sitioId, year, quarter]);
  const location = [barangays.find((item) => item.id === barangayId)?.name, puroks.find((item) => item.id === purokId)?.name, sitios.find((item) => item.id === sitioId)?.name].filter(Boolean).join(" / ") || "All assigned communities";
  const period = year ? `${year}${quarter ? ` · ${quarterNames[Number(quarter)]}` : " · All quarters"}` : "All recorded households";
  const exportHref = (format: "xlsx" | "pdf") => {
    const query = new URLSearchParams({ format });
    if (barangayId) query.set("barangay", barangayId);
    if (purokId) query.set("purok", purokId);
    if (sitioId) query.set("sitio", sitioId);
    if (year) query.set("year", year);
    if (quarter) query.set("quarter", quarter);
    return `/api/household-summary?${query}`;
  };
  const renderGroup = (group: (typeof summary.sections)[number]) => <section className="household-summary-card" key={group.title} aria-label={group.title}>
    <div className="household-summary-card-heading"><h4>{group.title}</h4><span>Total {group.total}</span></div>
    <dl className="household-summary-list">{group.items.map((item) => <div className={item.value === 0 ? "household-summary-row household-summary-zero" : "household-summary-row"} key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
    {group.items.every((item) => item.value === 0) && <p className="household-summary-empty">No counts recorded</p>}
  </section>;
  return <section className="household-summary" aria-labelledby="household-summary-heading">
    <div className="household-summary-toolbar"><div><p className="eyebrow">Portfolio totals</p><h2 id="household-summary-heading">Household profile summary</h2><p>Counts are calculated from the saved household profiles in your assigned communities.</p></div><div className="household-summary-actions"><Link href="/worker-portfolio" className="secondary-button"><ArrowLeft aria-hidden="true" />Profiles</Link><a href={exportHref("xlsx")} className="secondary-button"><FileDown aria-hidden="true" />Download Excel</a><a href={exportHref("pdf")} className="secondary-button"><FileDown aria-hidden="true" />Download PDF</a></div></div>
    <div className="household-summary-filters" aria-label="Summary filters">
      <div className="field"><label htmlFor="summary-barangay">Barangay</label><select id="summary-barangay" value={barangayId} onChange={(event) => { setBarangayId(event.target.value); setPurokId(""); setSitioId(""); }}><option value="">All assigned barangays</option>{barangays.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div className="field"><label htmlFor="summary-purok">Purok</label><select id="summary-purok" value={purokId} disabled={!barangayId} onChange={(event) => setPurokId(event.target.value)}><option value="">All Puroks</option>{puroks.filter((item) => item.barangay_id === barangayId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div className="field"><label htmlFor="summary-sitio">Sitio</label><select id="summary-sitio" value={sitioId} disabled={!barangayId} onChange={(event) => setSitioId(event.target.value)}><option value="">All Sitios</option>{sitios.filter((item) => item.barangay_id === barangayId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div className="field"><label htmlFor="summary-year">Visit year</label><select id="summary-year" value={year} onChange={(event) => { setYear(event.target.value); setQuarter(""); }}><option value="">All years</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
      <div className="field"><label htmlFor="summary-quarter">Quarter</label><select id="summary-quarter" value={quarter} disabled={!year} onChange={(event) => setQuarter(event.target.value)}><option value="">All quarters</option>{quarterNames.map((item, index) => <option key={item} value={index}>{item}</option>)}</select></div>
    </div>
    <div className="household-summary-context"><strong>{location}</strong><span>{period} · BHW: {workerName}</span></div>
    <div className="household-summary-totals"><div><span>Households</span><strong>{summary.households}</strong></div><div><span>Members</span><strong>{summary.members}</strong></div><div><span>As of</span><strong>{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${summary.asOf}T00:00:00Z`))}</strong></div></div>
    <div className="household-summary-view-options"><p>Category totals</p><button type="button" className="secondary-button" aria-pressed={showZeros} onClick={() => setShowZeros(!showZeros)}>{showZeros ? "Hide zero counts" : "Show zero counts"}</button></div>
    <div className={showZeros ? "household-summary-groups household-summary-show-zero" : "household-summary-groups"}>
      {summarySectionGroups.map((sectionGroup) => <section className="household-summary-group" key={sectionGroup.title}><h3>{sectionGroup.title}</h3><div className="household-summary-grid">{sectionGroup.indices.map((index) => renderGroup(summary.sections[index]))}
        {sectionGroup.title === "Health and care" && <section className="household-summary-card household-summary-family" aria-label="18. Family planning"><div className="household-summary-card-heading"><h4>18. Family planning users</h4><span>Total {summary.familyPlanningTotal}</span></div><div className="household-summary-table-scroll" role="region" aria-label="Family planning by age group" tabIndex={0}><table><thead><tr><th scope="col">Method</th><th scope="col">10–14</th><th scope="col">15–19</th><th scope="col">20–49</th><th scope="col">Total</th></tr></thead><tbody>{summary.familyPlanning.map((row) => <tr className={row.value === 0 ? "household-summary-zero" : undefined} key={row.label}><th scope="row">{row.label}</th>{row.groups.map((value, index) => <td key={index}>{value}</td>)}<td>{row.value}</td></tr>)}</tbody></table></div>{summary.familyPlanningTotal === 0 && <p className="household-summary-empty">No counts recorded</p>}</section>}
      </div></section>)}
    </div>
    <details className="household-summary-method"><summary>How these totals are counted</summary><p>Blank answers are not counted. Year and quarter filters include households with a matching visit date. With all quarters selected, classifications use each member’s latest recorded quarter. Some categories can overlap.</p><p>Smoking history, waist circumference, BMI, and cardiovascular risk level are unavailable because the household form does not collect those details.</p></details>
  </section>;
}
