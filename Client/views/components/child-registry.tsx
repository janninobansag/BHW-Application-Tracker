"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Barangay, Child, Purok, Sitio } from "@/Data/entities";
import { ChildRecordFilters } from "@/Client/views/components/child-record-filters";
import { ChildRecordsTable } from "@/Client/views/components/child-records-table";
import { ExportExcelDialog } from "@/Client/views/components/export-excel-dialog";
import { Plus, SearchX } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/Client/shared/components/ui/dialog";
import { ageInMonths } from "@/Services/child-records";

export function ChildRegistry({
  records,
  barangays,
  puroks,
  sitios,
  today,
  initialQuery,
  initialBarangayId,
  initialPurokId,
  initialAgeFilter,
  children,
  program = "deworming",
}: {
  records: Child[];
  barangays: Barangay[];
  puroks: Purok[];
  sitios: Sitio[];
  today: string;
  initialQuery: string;
  initialBarangayId: string;
  initialPurokId: string;
  initialAgeFilter: string;
  children: ReactNode;
  program?: "deworming" | "timbang";
}) {
  const [query, setQuery] = useState(initialQuery);
  const [barangayId, setBarangayId] = useState(initialBarangayId);
  const [purokId, setPurokId] = useState(initialPurokId);
  const [ageFilter, setAgeFilter] = useState(initialAgeFilter);
  const [showNewRecord, setShowNewRecord] = useState(false);
  const [announcedCount, setAnnouncedCount] = useState(records.length);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleRecords = records.filter((record) =>
    (!normalizedQuery || record.name.toLowerCase().includes(normalizedQuery) || record.parents.toLowerCase().includes(normalizedQuery))
    && (!barangayId || record.barangay_id === barangayId)
    && (!purokId || record.purok_id === purokId)
    && (!ageFilter || (program === "timbang"
      ? ageFilter !== "73-plus" || ageInMonths(record.birthday, today) >= 73
      : ageFilter === "under-6" ? ageInMonths(record.birthday, today) < 6 : ageFilter === "60-plus" ? ageInMonths(record.birthday, today) >= 60 : true)),
  );
  const male = visibleRecords.filter((record) => record.sex === "M").length;
  const female = visibleRecords.filter((record) => record.sex === "F").length;

  useEffect(() => {
    const timer = window.setTimeout(() => setAnnouncedCount(visibleRecords.length), 350);
    return () => window.clearTimeout(timer);
  }, [visibleRecords.length]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    ["q", "barangay", "purok", "age"].forEach((key) => params.delete(key));
    if (query) params.set("q", query);
    if (barangayId) params.set("barangay", barangayId);
    if (purokId) params.set("purok", purokId);
    if (ageFilter) params.set("age", ageFilter);
    const nextUrl = `${window.location.pathname}${params.size ? `?${params.toString()}` : ""}${window.location.hash}`;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== nextUrl) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [ageFilter, barangayId, purokId, query]);

  const returnParams = new URLSearchParams();
  if (query) returnParams.set("q", query);
  if (barangayId) returnParams.set("barangay", barangayId);
  if (purokId) returnParams.set("purok", purokId);
  if (ageFilter) returnParams.set("age", ageFilter);
  const basePath = program === "timbang" ? "/operation-timbang" : "/";
  const returnTo = returnParams.size ? `${basePath}?${returnParams.toString()}` : basePath;

  return <Dialog open={showNewRecord} onOpenChange={setShowNewRecord}>
    <div className="stats-grid" aria-label="Record totals">
      <div className="stat"><span>Total children</span><strong>{visibleRecords.length}</strong><small>{query || barangayId || purokId || ageFilter ? "Matching your filters" : "In your registry"}</small></div>
      <div className="stat"><span>Male</span><strong>{male}</strong><small>Recorded as M</small></div>
      <div className="stat"><span>Female</span><strong>{female}</strong><small>Recorded as F</small></div>
    </div>
    <div className={`workspace-grid registry-workspace registry-workspace-online${program === "timbang" ? " timbang-registry" : ""}`}>
      <section className="panel record-panel">
        <div className="section-heading"><div><p className="eyebrow">Your registry</p><h2>{program === "timbang" ? "Operation Timbang records" : "Vitamin A & Deworming"} <span className="registry-total-badge">{records.length}</span></h2></div><div className="registry-heading-actions"><ExportExcelDialog barangays={barangays} puroks={puroks} sitios={sitios} program={program} /><DialogTrigger asChild><button type="button" className="primary-button registry-add-record"><Plus aria-hidden="true" />Add child</button></DialogTrigger></div></div>
        <ChildRecordFilters
          program={program}
          barangays={barangays}
          puroks={puroks}
          query={query}
          barangayId={barangayId}
          purokId={purokId}
          ageFilter={ageFilter}
          onQueryChange={setQuery}
          onBarangayChange={(value) => { setBarangayId(value); setPurokId(""); }}
          onPurokChange={setPurokId}
          onAgeFilterChange={setAgeFilter}
        />
        <span className="sr-only" role="status">{announcedCount} matching records</span>
        {visibleRecords.length ? <ChildRecordsTable key={`${query}:${barangayId}:${purokId}:${ageFilter}`} records={visibleRecords} today={today} returnTo={returnTo} program={program} /> : <div className="empty-state"><SearchX aria-hidden="true" /><h3>{records.length ? "No matching records" : "Your registry starts here"}</h3><p>{query || barangayId || purokId || ageFilter ? "Try a different name or clear your search and filters." : "Add a child to start building your community’s health records."}</p><button className="secondary-button" type="button" onClick={() => { if (query || barangayId || purokId || ageFilter) { setQuery(""); setBarangayId(""); setPurokId(""); setAgeFilter(""); } else setShowNewRecord(true); }}>{query || barangayId || purokId || ageFilter ? "Clear search and filters" : "Add your first child"}</button></div>}
        <p className="table-note">Age is calculated in full months as of {new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }).format(new Date(`${today}T00:00:00+08:00`))}.</p>
      </section>
    </div>
    <DialogContent className={`new-record-dialog${program === "timbang" ? " timbang-record-dialog" : ""}`}><DialogHeader><p className="eyebrow">New registry entry</p><DialogTitle>{program === "timbang" ? "Add Operation Timbang record" : "Add a child"}</DialogTitle><DialogDescription>{program === "timbang" ? "Add the child’s details and community. Measurements can be completed later." : "Enter the child’s details and assigned community. All fields are required."}</DialogDescription></DialogHeader>{children}</DialogContent>
  </Dialog>;
}
