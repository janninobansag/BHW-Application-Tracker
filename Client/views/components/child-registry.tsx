"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Barangay, Child, Purok, Sitio } from "@/Data/entities";
import { ChildRecordFilters } from "@/Client/views/components/child-record-filters";
import { ChildRecordsTable } from "@/Client/views/components/child-records-table";
import { ExportExcelDialog } from "@/Client/views/components/export-excel-dialog";

export function ChildRegistry({
  records,
  barangays,
  puroks,
  sitios,
  today,
  initialQuery,
  initialBarangayId,
  initialPurokId,
  children,
}: {
  records: Child[];
  barangays: Barangay[];
  puroks: Purok[];
  sitios: Sitio[];
  today: string;
  initialQuery: string;
  initialBarangayId: string;
  initialPurokId: string;
  children: ReactNode;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [barangayId, setBarangayId] = useState(initialBarangayId);
  const [purokId, setPurokId] = useState(initialPurokId);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleRecords = records.filter((record) =>
    (!normalizedQuery || record.name.toLowerCase().includes(normalizedQuery) || record.parents.toLowerCase().includes(normalizedQuery))
    && (!barangayId || record.barangay_id === barangayId)
    && (!purokId || record.purok_id === purokId),
  );
  const male = visibleRecords.filter((record) => record.sex === "M").length;
  const female = visibleRecords.filter((record) => record.sex === "F").length;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    ["q", "barangay", "purok"].forEach((key) => params.delete(key));
    if (query) params.set("q", query);
    if (barangayId) params.set("barangay", barangayId);
    if (purokId) params.set("purok", purokId);
    const nextUrl = `${window.location.pathname}${params.size ? `?${params.toString()}` : ""}${window.location.hash}`;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== nextUrl) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [barangayId, purokId, query]);

  const returnParams = new URLSearchParams();
  if (query) returnParams.set("q", query);
  if (barangayId) returnParams.set("barangay", barangayId);
  if (purokId) returnParams.set("purok", purokId);
  const returnTo = returnParams.size ? `/?${returnParams.toString()}` : "/";

  return <>
    <div className="stats-grid" aria-label="Record totals">
      <div className="stat"><span>Total children</span><strong>{visibleRecords.length}</strong><small>In the current view</small></div>
      <div className="stat"><span>Male</span><strong>{male}</strong><small>Recorded as M</small></div>
      <div className="stat"><span>Female</span><strong>{female}</strong><small>Recorded as F</small></div>
    </div>
    <div className="workspace-grid">
      <section className="panel record-panel">
        <div className="section-heading"><div><p className="eyebrow">Registry</p><h2>Children in your care</h2></div><ExportExcelDialog barangays={barangays} puroks={puroks} sitios={sitios} /></div>
        <ChildRecordFilters
          barangays={barangays}
          puroks={puroks}
          query={query}
          barangayId={barangayId}
          purokId={purokId}
          onQueryChange={setQuery}
          onBarangayChange={(value) => { setBarangayId(value); setPurokId(""); }}
          onPurokChange={setPurokId}
        />
        {visibleRecords.length ? <ChildRecordsTable key={`${query}:${barangayId}:${purokId}`} records={visibleRecords} today={today} returnTo={returnTo} /> : <div className="empty-state"><strong>No children found</strong><p>{query || barangayId || purokId ? "Try another search, barangay, or Purok filter." : "Add the first child record using the form."}</p></div>}
        <p className="table-note">Ages use full months as of {today}. Search and filters update immediately.</p>
      </section>
      {children}
    </div>
  </>;
}
