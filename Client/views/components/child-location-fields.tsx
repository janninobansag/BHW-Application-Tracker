"use client";

import { useState } from "react";
import type { Barangay, Purok } from "@/Data/entities";

export function ChildLocationFields({
  barangays,
  puroks,
  initialBarangayId = "",
  initialPurokId = "",
}: {
  barangays: Barangay[];
  puroks: Purok[];
  initialBarangayId?: string;
  initialPurokId?: string;
}) {
  const [barangayId, setBarangayId] = useState(initialBarangayId);
  const [purokId, setPurokId] = useState(initialPurokId);
  const availablePuroks = puroks.filter((purok) => purok.barangay_id === barangayId);

  return <>
    <div className="field"><label htmlFor="barangayId">Barangay</label><select id="barangayId" name="barangayId" required value={barangayId}
      onChange={(event) => { setBarangayId(event.target.value); setPurokId(""); }}>
      <option value="" disabled>Select a barangay</option>
      {barangays.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></div>
    <div className="field"><label htmlFor="purokId">Purok</label><select id="purokId" name="purokId" required value={purokId}
      onChange={(event) => setPurokId(event.target.value)} disabled={!barangayId || availablePuroks.length === 0}>
      <option value="" disabled>{!barangayId ? "Select a barangay first" : availablePuroks.length ? "Select a Purok" : "No Puroks available"}</option>
      {availablePuroks.map((purok) => <option key={purok.id} value={purok.id}>{purok.name}</option>)}
    </select></div>
  </>;
}
