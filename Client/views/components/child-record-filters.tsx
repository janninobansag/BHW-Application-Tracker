"use client";

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

  return <form className="filters" aria-label="Filter child records" onSubmit={(event) => event.preventDefault()}>
    <div className="field"><label htmlFor="q">Search</label><input id="q" name="q" placeholder="Child or parent name" value={query} onChange={(event) => onQueryChange(event.target.value)} /></div>
    <div className="field"><label htmlFor="barangay">Barangay</label><select id="barangay" name="barangay" value={barangayId} onChange={(event) => onBarangayChange(event.target.value)}>
      <option value="">All assigned barangays</option>
      {barangays.map((barangay) => <option key={barangay.id} value={barangay.id}>{barangay.name}</option>)}
    </select></div>
    <div className="field"><label htmlFor="purok">Purok</label><select id="purok" name="purok" value={purokId} disabled={!barangayId || availablePuroks.length === 0} onChange={(event) => onPurokChange(event.target.value)}>
      <option value="">{!barangayId ? "Select a barangay first" : availablePuroks.length ? "All Puroks" : "No Puroks available"}</option>
      {availablePuroks.map((purok) => <option key={purok.id} value={purok.id}>{purok.name}</option>)}
    </select></div>
  </form>;
}
