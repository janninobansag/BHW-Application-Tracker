"use client";

import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import type { Barangay, Purok } from "@/Data/entities";

export function ChildRecordFilters({
  barangays,
  puroks,
  query,
  barangayId,
  purokId,
  onQueryChange,
  onBarangayChange,
  onPurokChange,
}: {
  barangays: Barangay[];
  puroks: Purok[];
  query: string;
  barangayId: string;
  purokId: string;
  onQueryChange: (value: string) => void;
  onBarangayChange: (value: string) => void;
  onPurokChange: (value: string) => void;
}) {
  const availablePuroks = puroks.filter((purok) => purok.barangay_id === barangayId);
  const [expanded, setExpanded] = useState(Boolean(barangayId || purokId));
  const filterCount = Number(Boolean(barangayId)) + Number(Boolean(purokId));

  return <form className={`filters registry-filters${expanded ? " filters-expanded" : ""}`} aria-label="Filter child records" onSubmit={(event) => event.preventDefault()}>
    <div className="field registry-search-field"><label htmlFor="q">Search records</label><div className="registry-search-input"><Search aria-hidden="true" /><input id="q" name="q" type="search" placeholder="Child or parent name" value={query} onChange={(event) => onQueryChange(event.target.value)} /></div></div>
    <button className="registry-filter-toggle" type="button" aria-expanded={expanded} aria-controls="registry-location-filters" onClick={() => setExpanded((current) => !current)}><SlidersHorizontal aria-hidden="true" /><span>Filters{filterCount ? ` (${filterCount})` : ""}</span></button>
    <div id="registry-location-filters" className="registry-filter-locations">
    <div className="field"><label htmlFor="barangay">Barangay</label><select id="barangay" name="barangay" value={barangayId} onChange={(event) => onBarangayChange(event.target.value)}>
      <option value="">All assigned barangays</option>
      {barangays.map((barangay) => <option key={barangay.id} value={barangay.id}>{barangay.name}</option>)}
    </select></div>
    <div className="field"><label htmlFor="purok">Purok</label><select id="purok" name="purok" value={purokId} disabled={!barangayId || availablePuroks.length === 0} onChange={(event) => onPurokChange(event.target.value)}>
      <option value="">{!barangayId ? "Select a barangay first" : availablePuroks.length ? "All Puroks" : "No Puroks available"}</option>
      {availablePuroks.map((purok) => <option key={purok.id} value={purok.id}>{purok.name}</option>)}
    </select></div>
    </div>
    {filterCount > 0 && <div className="registry-active-filters"><span>{barangays.find((item) => item.id === barangayId)?.name}{purokId ? ` / ${availablePuroks.find((item) => item.id === purokId)?.name || ""}` : ""}</span><button type="button" onClick={() => { onBarangayChange(""); onPurokChange(""); }}>Clear filters</button></div>}
  </form>;
}
