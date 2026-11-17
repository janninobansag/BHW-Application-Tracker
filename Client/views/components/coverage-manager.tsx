"use client";

import { addBarangay, addPurok, editBarangay, editPurok } from "@/Client/controllers/actions";
import type { Barangay, Purok } from "@/Data/repositories";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/Client/shared/components/ui/dialog";

export function CoverageManager({ barangays, puroks }: { barangays: Barangay[]; puroks: Purok[] }) {
  return <section className="panel coverage-panel">
    <div className="coverage-title"><div><p className="eyebrow">Coverage setup</p><h2>Barangays and Puroks</h2><p className="muted">Add each Barangay first, then manage its Puroks underneath.</p></div></div>
    <form action={addBarangay} className="coverage-add-barangay">
      <label className="field"><span>New Barangay</span><input name="name" maxLength={100} placeholder="Enter barangay name" required /></label>
      <button className="secondary-button" type="submit">Add Barangay</button>
    </form>
    {barangays.length ? <div className="coverage-tree">{barangays.map((barangay) => {
      const barangayPuroks = puroks.filter((purok) => purok.barangay_id === barangay.id);
      return <article className="coverage-card" key={barangay.id}>
        <div className="coverage-card-heading"><div><span className="coverage-label">BARANGAY</span><h3>{barangay.name}</h3></div>
          <Dialog><DialogTrigger asChild><button className="text-button" type="button">Edit</button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>Edit Barangay</DialogTitle><DialogDescription>Update the Barangay name. Existing Puroks and child records stay linked to it.</DialogDescription></DialogHeader>
              <form action={editBarangay} className="form-stack"><input type="hidden" name="barangayId" value={barangay.id} /><div className="field"><label htmlFor={`edit-barangay-${barangay.id}`}>Barangay name</label><input id={`edit-barangay-${barangay.id}`} name="name" defaultValue={barangay.name} maxLength={100} required /></div><DialogFooter><button className="primary-button" type="submit">Save Barangay</button></DialogFooter></form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="purok-section"><div className="purok-heading"><h4>Puroks</h4><span>{barangayPuroks.length}</span></div>
          {barangayPuroks.length ? <ul className="purok-list">{barangayPuroks.map((purok) => <li key={purok.id}><span>{purok.name}</span>
            <Dialog><DialogTrigger asChild><button className="text-button" type="button">Edit</button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Edit Purok</DialogTitle><DialogDescription>Change the Purok name within Barangay {barangay.name}.</DialogDescription></DialogHeader>
                <form action={editPurok} className="form-stack"><input type="hidden" name="purokId" value={purok.id} /><div className="field"><label htmlFor={`edit-purok-${purok.id}`}>Purok name</label><input id={`edit-purok-${purok.id}`} name="name" defaultValue={purok.name} maxLength={100} required /></div><DialogFooter><button className="primary-button" type="submit">Save Purok</button></DialogFooter></form>
              </DialogContent>
            </Dialog>
          </li>)}</ul> : <p className="purok-empty">No Puroks yet. Add the first one below.</p>}
          <form action={addPurok} className="coverage-add-purok"><input type="hidden" name="barangayId" value={barangay.id} /><label className="field"><span>Add Purok to {barangay.name}</span><input name="name" maxLength={100} placeholder="Enter Purok name" required /></label><button className="secondary-button" type="submit">Add Purok</button></form>
        </div>
      </article>;
    })}</div> : <div className="coverage-empty"><strong>No Barangays yet</strong><p>Add a Barangay above, then add its Puroks.</p></div>}
  </section>;
}
