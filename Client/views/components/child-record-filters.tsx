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
  ageFilter,
  onQueryChange,
  onBarangayChange,
  onPurokChange,
  onAgeFilterChange,
}: {
  barangays: Barangay[];
  puroks: Purok[];
  query: string;
  barangayId: string;
  purokId: string;
  ageFilter: string;
  onQueryChange: (value: string) => void;
  onBarangayChange: (value: string) => void;
  onPurokChange: (value: string) => void;
  onAgeFilterChange: (value: string) => void;
}) {
  const availablePuroks = puroks.filter((purok) => purok.barangay_id === barangayId);
  const [expanded, setExpanded] = useState(Boolean(barangayId || purokId || ageFilter));
  const filterCount = Number(Boolean(barangayId)) + Number(Boolean(purokId)) + Number(Boolean(ageFilter));

  return <search className="registry-search" aria-label="Search and filter child records"><form className={`filters registry-filters${expanded ? " filters-expanded" : ""}`} aria-label="Filter child records" onSubmit={(event) => event.preventDefault()}>
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
    <fieldset className="registry-age-filter">
      <legend>Age range</legend>
      <div className="registry-age-options">
        <label htmlFor="age-all"><input id="age-all" type="radio" name="age" value="" checked={!ageFilter} onChange={() => onAgeFilterChange("")} />All ages</label>
        <label htmlFor="age-under-5"><input id="age-under-5" type="radio" name="age" value="under-5" checked={ageFilter === "under-5"} onChange={() => onAgeFilterChange("under-5")} />Under 5 months</label>
        <label htmlFor="age-over-60"><input id="age-over-60" type="radio" name="age" value="over-60" checked={ageFilter === "over-60"} onChange={() => onAgeFilterChange("over-60")} />Over 60 months</label>
      </div>
    </fieldset>
    </div>
  </form></search>;
}
