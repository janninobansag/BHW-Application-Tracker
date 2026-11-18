"use client";

import { useState } from "react";
import { saveAssignments } from "@/Client/controllers/actions";
import type { Barangay, Purok } from "@/Data/entities";

type AssignmentManagerProps = {
  userId: string;
  barangays: Barangay[];
  puroks: Purok[];
  assignedBarangayIds: string[];
  assignedPurokIds: string[];
};

export function AssignmentManager({ userId, barangays, puroks, assignedBarangayIds, assignedPurokIds }: AssignmentManagerProps) {
  const [selectedBarangayIds, setSelectedBarangayIds] = useState(assignedBarangayIds);
  const initiallyAssignedBarangays = new Set(assignedBarangayIds);
  const [selectedPurokIds, setSelectedPurokIds] = useState(() => assignedPurokIds.filter((id) => {
    const purok = puroks.find((item) => item.id === id);
    return !!purok && initiallyAssignedBarangays.has(purok.barangay_id);
  }));
  const selectedBarangaySet = new Set(selectedBarangayIds);
  const visibleBarangays = barangays.filter((barangay) => selectedBarangaySet.has(barangay.id));

  function toggleBarangay(barangayId: string, checked: boolean) {
    setSelectedBarangayIds((current) => checked
      ? current.includes(barangayId) ? current : [...current, barangayId]
      : current.filter((id) => id !== barangayId));
    if (!checked) {
      const childPurokIds = new Set(puroks.filter((purok) => purok.barangay_id === barangayId).map((purok) => purok.id));
      setSelectedPurokIds((current) => current.filter((id) => !childPurokIds.has(id)));
    }
  }

  function togglePurok(purokId: string, checked: boolean) {
    setSelectedPurokIds((current) => checked
      ? current.includes(purokId) ? current : [...current, purokId]
      : current.filter((id) => id !== purokId));
  }

  return <form action={saveAssignments} className="assignment-form">
    <input type="hidden" name="userId" value={userId} />
    <strong>Assigned Barangays</strong>
    <div className="checkbox-list">
      {barangays.map((barangay) => <label key={barangay.id}>
        <input type="checkbox" name="barangayId" value={barangay.id} checked={selectedBarangaySet.has(barangay.id)} onChange={(event) => toggleBarangay(barangay.id, event.target.checked)} />
        {barangay.name}
      </label>)}
    </div>
    <strong>Assigned Puroks</strong>
    {visibleBarangays.length ? <div className="assignment-purok-groups">
      {visibleBarangays.map((barangay) => {
        const barangayPuroks = puroks.filter((purok) => purok.barangay_id === barangay.id);
        return <fieldset className="assignment-purok-group" key={barangay.id}>
          <legend>{barangay.name}</legend>
          {barangayPuroks.length ? <div className="checkbox-list">
            {barangayPuroks.map((purok) => <label key={purok.id}>
              <input type="checkbox" name="purokId" value={purok.id} checked={selectedPurokIds.includes(purok.id)} onChange={(event) => togglePurok(purok.id, event.target.checked)} />
              {purok.name}
            </label>)}
          </div> : <p className="assignment-hint">No Puroks have been added for this Barangay yet.</p>}
        </fieldset>;
      })}
    </div> : <p className="assignment-hint">Select a Barangay above to view its Puroks.</p>}
    <button className="secondary-button" type="submit">Save assignments</button>
  </form>;
}
